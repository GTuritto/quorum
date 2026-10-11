/** Development-only reference for Super profiles and observed launch settings.
 * Metadata must come from the host, not inference probes or worker assertions.
 * This module does not discover models, launch agents, or change host settings.
 */
const fields = ['model', 'effort'];

function record(value, label, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  if (keys && Object.keys(value).some(key => !keys.includes(key))) {
    throw new TypeError(`${label} contains an unknown field`);
  }
  return value;
}

function profile(value, label) {
  record(value, label, fields);
  for (const [key, setting] of Object.entries(value)) {
    if (typeof setting !== 'string' || !setting.trim() || setting !== setting.trim()) {
      throw new TypeError(`${label}.${key} must be a nonempty model/effort name or inherit`);
    }
  }
  return { ...value };
}

export function slotRole(slot, counts) {
  const match = /^(candidate|reviewer)-([1-9]\d*)$/.exec(slot);
  if (!match || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) > counts[`${match[1]}s`]) {
    throw new TypeError(`Unknown or out-of-range agent slot: ${slot}`);
  }
  return match[1];
}

export function validateInference(value, targets) {
  record(value, 'Super inference', ['defaults', 'agents']);
  const defaults = Object.hasOwn(value, 'defaults') ? profile(value.defaults, 'defaults') : {};
  const overrides = Object.hasOwn(value, 'agents') ? record(value.agents, 'agents') : {};
  const agents = {};
  for (const [slot, settings] of Object.entries(overrides)) {
    slotRole(slot, targets);
    agents[slot] = profile(settings, slot);
  }
  if (![defaults, ...Object.values(agents)].some(item => Object.values(item).some(value => value !== 'inherit'))) {
    throw new TypeError('Super requires at least one concrete model or effort assignment; clarify the task-specific profile');
  }
  return { defaults: { model: 'inherit', effort: 'inherit', ...defaults }, agents };
}

export function resolveInference(requested, capabilities) {
  const metadata = capabilities.inference;
  if (!metadata || typeof metadata.provider !== 'string' || !metadata.provider ||
      !metadata.inherited || !Array.isArray(metadata.models)) {
    throw new TypeError('Super requires verified host model/effort metadata before dispatch');
  }
  const resolve = (settings) => {
    const model = settings.model === 'inherit' ? metadata.inherited.model : settings.model;
    const effort = settings.effort === 'inherit' ? metadata.inherited.effort : settings.effort;
    const matches = metadata.models.filter(item => item.id === model);
    const supported = matches.length === 1 ? matches[0] : undefined;
    if (!supported || supported.provider !== metadata.provider || !Array.isArray(supported.efforts) ||
        !supported.efforts.includes(effort) || typeof effort !== 'string' || !effort.trim()) {
      throw new TypeError(`Unsupported or cross-provider model/effort: ${model}/${effort}; clarify before dispatch`);
    }
    if ((metadata.forcedModel !== undefined && metadata.forcedModel !== model) ||
        (metadata.forcedEffort !== undefined && metadata.forcedEffort !== effort)) {
      throw new TypeError('Host override conflicts with the requested model/effort');
    }
    if (model !== metadata.inherited.model && metadata.perAgentModel !== true) {
      throw new TypeError('Host cannot apply the requested per-agent model');
    }
    if (effort !== metadata.inherited.effort && metadata.perAgentEffort !== true) {
      throw new TypeError('Host cannot apply the requested per-agent effort');
    }
    return Object.freeze({ provider: metadata.provider, model, effort });
  };
  const snapshot = Object.freeze({
    defaults: Object.freeze({ ...requested.defaults }),
    agents: Object.freeze(Object.fromEntries(Object.entries(requested.agents).map(([slot, settings]) =>
      [slot, Object.freeze({ ...settings })]))),
  });
  return Object.freeze({
    requested: snapshot,
    defaults: resolve(requested.defaults),
    agents: Object.freeze(Object.fromEntries(Object.entries(requested.agents).map(([slot, settings]) =>
      [slot, resolve({ ...requested.defaults, ...settings })]))),
  });
}

export function profileForSlot(plan, slot) {
  slotRole(slot, plan.allocated);
  if (!plan.inference) throw new TypeError('Super profile was not resolved');
  return plan.inference.agents[slot] ?? plan.inference.defaults;
}

export function inferenceReceipt(plan, launches, accepted) {
  const attempts = launches.map(launch => {
    let resolved;
    try {
      if (slotRole(launch.slot, plan.allocated) === launch.role) resolved = profileForSlot(plan, launch.slot);
    } catch { /* Malformed receipts are reported, never inferred as successful. */ }
    const actual = {
      provider: launch.providerVerified === true ? launch.provider ?? null : null,
      model: launch.modelVerified === true ? launch.model ?? null : null,
      effort: launch.effortVerified === true ? launch.effort ?? null : null,
    };
    const mismatch = resolved && Object.entries(actual).some(([key, value]) => value !== null && value !== resolved[key]);
    const status = !resolved ? 'invalid-slot' : mismatch ? 'mismatch'
      : Object.values(actual).some(value => value === null) ? 'unverified' : 'verified';
    const requested = plan.inference ? {
      ...plan.inference.requested.defaults,
      ...plan.inference.requested.agents[launch.slot],
    } : null;
    return { id: launch.id, role: launch.role, slot: launch.slot ?? null, requested, resolved: resolved ?? null, actual, status };
  });
  const acceptedAttempts = attempts.filter((_, index) => accepted.includes(launches[index]));
  const uniqueSlots = new Set(acceptedAttempts.map(attempt => attempt.slot));
  const applied = plan.tier === 'super' && acceptedAttempts.length > 0 &&
    acceptedAttempts.every(attempt => attempt.status === 'verified') &&
    uniqueSlots.size === acceptedAttempts.length &&
    uniqueSlots.size === plan.allocated.candidates + plan.allocated.reviewers;
  return { applied, requested: plan.requestedInference, attempts };
}
