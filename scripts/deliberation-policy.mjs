import { isDeepStrictEqual } from 'node:util';
import { validateInference, resolveInference, profileForSlot, slotRole, inferenceReceipt } from './super-policy.mjs';

/**
 * Development-only reference policy. Hosts normalize semantic inputs and enforce
 * their own restrictions; this module neither launches workers nor parses text.
 * The caller carries the plan and ledger; the module keeps no state. A launch record represents one dispatch,
 * including failed attempts. In-context repair updates that same record.
 * valid omitted means pending; valid false means a completed failed attempt.
 */
const defaults = { candidates: 3, reviewers: 1 };
const roles = ['candidate', 'reviewer'];
const delegated = tier => tier === 'full' || tier === 'super';

function integer(value, minimum, name) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name} must be a safe integer >= ${minimum}; clarify this control before dispatch`);
  }
  return value;
}

/**
 * Input: level, exploration, directPrefix (already recognized leading Direct:),
 * candidates, reviewers, maxWorkers, invoked; capabilities
 * {isolatedWorkers, concurrency, inference?}; Super inference profiles and host
 * model/effort metadata are validated by super-policy.mjs.
 * signals {routine, approvedImplementation, newMaterialUncertainty,
 * consequential, difficultToReverse, uncertain, independentValue,
 * boundedAmbiguity, exploratoryIntent, newAlternatives}; decision {available,
 * compatible, newEvidence, changedGoal, changedConstraint, changedAssumptions,
 * reconsider} from this conversation. Optional second argument for post-synthesis
 * withdrawal: {plan, launches, independentResultIds}. Supply the original
 * request controls with the new independent task signals. IDs are current-task
 * evidence judgments, including that a retained review covers a retained artifact.
 * Missing evidence is excluded. Normal in-flight replacements use dispatchEligibility.
 */
export function planDeliberation(input = {}, completedRun) {
  const reasons = [];
  const bypass = input.directPrefix === true;
  const requestedTier = bypass ? 'direct' : (input.level ?? 'auto');
  if (!['auto', 'direct', 'mini', 'full', 'super'].includes(requestedTier)) {
    throw new TypeError('level must be auto, direct, mini, full, or super');
  }
  const requestedExploration = bypass ? 'auto' : (input.exploration === undefined ? 'auto' : input.exploration);
  if (!['auto', 'on', 'off'].includes(requestedExploration)) {
    throw new TypeError('exploration must be auto, on, or off');
  }
  const explicitCounts = input.candidates !== undefined || input.reviewers !== undefined;
  const targets = bypass ? { ...defaults } : {
    candidates: integer(input.candidates === undefined ? defaults.candidates : input.candidates, 1, 'candidates'),
    reviewers: integer(input.reviewers === undefined ? defaults.reviewers : input.reviewers, 1, 'reviewers'),
  };
  if (!bypass && input.inference !== undefined && requestedTier !== 'super') {
    throw new TypeError('inference assignments require explicit level=super');
  }
  const requestedInference = requestedTier === 'super' ? validateInference(input.inference, targets) : undefined;
  const maxWorkers = bypass ? 0 : integer(
    input.maxWorkers === undefined ? (explicitCounts ? targets.candidates + targets.reviewers : 4) : input.maxWorkers,
    0, 'maxWorkers',
  );
  let tier = requestedTier;
  let reusedDecision = false;
  const signals = input.signals ?? {};
  const decision = input.decision ?? {};
  const creativeRequest = requestedExploration === 'on' || signals.exploratoryIntent === true || signals.newAlternatives === true;
  const explorationRequested = requestedExploration === 'on' ||
    (requestedExploration === 'auto' && (signals.exploratoryIntent === true || signals.newAlternatives === true));
  const materialChange = signals.newMaterialUncertainty ||
    ['newEvidence', 'changedGoal', 'changedConstraint', 'changedAssumptions', 'reconsider'].some(key => decision[key]);
  if (bypass) reasons.push('Leading Direct: bypasses all deliberation controls.');
  if (tier === 'auto') {
    if ((signals.routine || signals.approvedImplementation) && !materialChange && !creativeRequest) {
      tier = 'direct';
      reasons.push('Routine execution or implementation of an approved decision.');
    } else if (decision.available && decision.compatible && !materialChange && !creativeRequest) {
      tier = 'direct';
      reusedDecision = true;
      reasons.push('Reuse the compatible decision from this conversation.');
    } else if ((signals.consequential || signals.difficultToReverse) && signals.uncertain && signals.independentValue) {
      tier = 'full';
      reasons.push('Consequential uncertain decision benefits from independent investigation.');
    } else if (explorationRequested) {
      tier = 'mini';
      reasons.push('Exploration intent benefits from structured generation and review.');
    } else if (signals.boundedAmbiguity) {
      tier = 'mini';
      reasons.push('Bounded ambiguity benefits from structured challenge.');
    } else {
      tier = 'direct';
      reasons.push('No material benefit from deliberation established.');
    }
  }
  if (completedRun) {
    const original = completedRun.plan;
    if (!Array.isArray(completedRun.launches) || !original || original.completedPanel ||
        (completedRun.launches.length && !delegated(original.tier))) {
      throw new TypeError('Recovery requires the original plan and original launch ledger');
    }
    if (original.requestedTier !== requestedTier || original.maxWorkers !== maxWorkers ||
        !isDeepStrictEqual(original.targets, targets) || original.requestedExploration !== requestedExploration ||
        !isDeepStrictEqual(original.requestedInference, requestedInference)) {
      throw new TypeError('Recovery must retain the original request controls');
    }
  }
  if (completedRun?.launches.length) {
    const original = completedRun.plan;
    const independentResultIds = completedRun.independentResultIds ?? [];
    if (!Array.isArray(independentResultIds)) throw new TypeError('Independent result IDs must be an array');
    const finished = new Set(completedRun.launches.filter(attempt => attempt.valid === true).map(attempt => attempt.id));
    const completedPanel = {
      plan: original,
      launches: structuredClone(completedRun.launches),
      independentResultIds: independentResultIds.filter(id => finished.has(id)),
    };
    const recovered = { ...original, tier, completedPanel, reusedDecision: false,
      explorationActive: explorationRequested && tier !== 'direct',
      reasons: [...original.reasons.map(reason => `Prior plan: ${reason}`), ...reasons,
        'The completed panel is closed to dispatch; the original attempts and slots are retained.'],
    };
    const receipt = executionReceipt(recovered, completedPanel.launches);
    if (receipt.tier !== tier) recovered.reasons.push(receipt.tier === 'full'
      ? 'Retained evidence supports Full; Super settings or slot coverage are incomplete.'
      : 'The completed panel lacks a currently supported candidate and independent review pair.');
    recovered.tier = receipt.tier;
    return recovered;
  }
  const capabilities = input.capabilities ?? {};
  if (delegated(tier) && (maxWorkers < 2 || capabilities.isolatedWorkers === false || capabilities.concurrency === 0)) {
    reasons.push(maxWorkers < 2 ? 'Full requires at least two total launches; degraded to mini.' :
      'Isolated workers unavailable under host restrictions; degraded to mini.');
    tier = 'mini';
  }
  const allocated = { candidates: 0, reviewers: 0 };
  if (tier === 'mini' && delegated(requestedTier)) {
    reasons.push(`Requested ${targets.candidates}+${targets.reviewers} workers; actual allocation is 0+0 after degradation.`);
  }
  if (delegated(tier)) {
    allocated.reviewers = Math.min(targets.reviewers, maxWorkers - 1);
    allocated.candidates = Math.min(targets.candidates, maxWorkers - allocated.reviewers);
    if (allocated.candidates < targets.candidates || allocated.reviewers < targets.reviewers) {
      reasons.push(`Cap reduces requested ${targets.candidates}+${targets.reviewers} to ${allocated.candidates}+${allocated.reviewers}.`);
    }
    if (allocated.candidates === 1) reasons.push('A single candidate lacks independent alternative generation.');
  } else if (explicitCounts && !bypass) {
    reasons.push('Explicit worker counts are unused in direct or mini.');
  }
  const inference = tier === 'super' ? resolveInference(requestedInference, capabilities) : undefined;
  if (requestedTier === 'super' && tier !== 'super') reasons.push('Super assignments unused after capacity fallback.');
  const explorationActive = explorationRequested && tier !== 'direct';
  if (!bypass && requestedTier === 'direct' && explorationRequested) {
    reasons.push('Explicit direct level bypasses structured exploration.');
  }
  return {
    requestedTier, requestedExploration, tier, explorationActive, targets, allocated, maxWorkers, reusedDecision, reasons,
    ...(requestedInference ? { requestedInference, inference } : {}),
    invoked: input.invoked === true || bypass || input.level !== undefined || input.exploration !== undefined ||
      explicitCounts || input.maxWorkers !== undefined,
  };
}

function participation(plan, launches, independentResultIds) {
  if (!Array.isArray(launches)) throw new TypeError('launches must be an array');
  if (!delegated(plan.tier) && launches.length) throw new RangeError('Direct and mini plans permit zero worker launches');
  if (launches.length > plan.maxWorkers) throw new RangeError('Worker launch cap exceeded, including failures and replacements');
  const launched = { candidates: 0, reviewers: 0 };
  const valid = { candidates: 0, reviewers: 0 };
  const ids = new Set();
  const candidateIds = new Set(launches.filter(item => item.role === 'candidate').map(item => item.id));
  const accepted = [];
  const lastCandidateIndex = launches.reduce((last, launch, index) => launch.role === 'candidate' ? index : last, -1);
  for (const [index, launch] of launches.entries()) {
    if (!roles.includes(launch.role)) throw new TypeError('Worker role must be candidate or reviewer');
    if (typeof launch.id !== 'string' || !launch.id.trim()) throw new TypeError('Worker id must be a nonempty context identifier');
    const key = `${launch.role}s`;
    launched[key]++;
    const unique = !ids.has(launch.id);
    ids.add(launch.id);
    const independent = launch.role === 'candidate' ||
      (launch.fresh === true && launch.independent === true && !candidateIds.has(launch.id) && valid.candidates > 0 && index > lastCandidateIndex);
    const usable = !independentResultIds || independentResultIds.has(launch.id);
    if (unique && launch.valid === true && launch.isolated === true && independent && usable) {
      valid[key]++;
      accepted.push(launch);
    }
  }
  return { launched, valid, accepted };
}

/**
 * Call BEFORE dispatching each new context, including replacement attempts.
 * This reserves the remaining planned reviews, and at least one replacement
 * review if every previous review failed. Concurrency never changes total cap.
 */
export function dispatchEligibility(plan, launches, role, slot) {
  if (!roles.includes(role)) throw new TypeError('Worker role must be candidate or reviewer');
  if (plan.completedPanel) return { allowed: false, reason: 'Synthesis completed; no generation or review may restart.' };
  const { launched, valid } = participation(plan, launches);
  if (!delegated(plan.tier)) return { allowed: false, reason: 'Only full or super launches workers.' };
  if (plan.tier === 'super') {
    try {
      if (slotRole(slot, plan.allocated) !== role) return { allowed: false, reason: 'Slot does not match worker role.' };
      profileForSlot(plan, slot);
    } catch (error) { return { allowed: false, reason: error.message }; }
    if (launches.some(launch => launch.slot === slot && launch.valid !== false)) {
      return { allowed: false, reason: 'Slot already satisfied or in flight.' };
    }
    const observed = inferenceReceipt(plan, launches, []).attempts;
    if (observed.some(attempt => ['mismatch', 'invalid-slot'].includes(attempt.status))) {
      return { allowed: false, reason: 'Host configuration mismatch or invalid slot; clarify before further dispatch.' };
    }
  }
  const remaining = plan.maxWorkers - launches.length;
  if (remaining === 0) return { allowed: false, reason: 'Total launch cap exhausted.' };
  const pending = launches.filter(launch => launch.role === role && launch.valid === undefined).length;
  if (valid[`${role}s`] + pending >= plan.allocated[`${role}s`]) {
    return { allowed: false, reason: 'Allocated target already satisfied or in flight; spare cap does not enlarge the panel.' };
  }
  if (role === 'reviewer' && launches.some(launch => launch.role === 'candidate' && launch.valid === undefined)) {
    return { allowed: false, reason: 'Wait for candidate workers to finish before independent review.' };
  }
  if (role === 'reviewer') return {
    allowed: valid.candidates > 0,
    reason: valid.candidates > 0 ? 'A valid candidate is available for independent review.' : 'Review requires a valid candidate first.',
  };
  if (launched.reviewers > 0) return { allowed: false, reason: 'Generation cannot resume after independent review starts.' };
  const reserve = Math.max(plan.allocated.reviewers - launched.reviewers, valid.reviewers > 0 ? 0 : 1);
  return {
    allowed: remaining > reserve,
    reason: remaining > reserve ? 'Review capacity remains reserved.' : 'Remaining launches reserved for independent review.',
  };
}

// An in-flight context can finish after synthesis. Its ID, role and slot
// are immutable. It was still pending when evidence was assessed for reuse.
function sameAttempt(recorded, current) {
  if (recorded.valid !== undefined) return isDeepStrictEqual(recorded, current);
  return current?.id === recorded.id && current.role === recorded.role && current.slot === recorded.slot;
}

/**
 * Records are in dispatch order: {id, role, valid, isolated, fresh, independent,
 * model, modelVerified}; Super also records slot, effort/provider and their
 * verification flags. Missing evidence is never presumed valid or verified.
 * A host must establish anonymization and independence before marking them.
 * options.miniAvailable=false models exhausted time/reasoning for fallback.
 */
export function executionReceipt(plan, launches, options = {}) {
  const panel = plan.completedPanel;
  if (panel && (!Array.isArray(launches) || launches.length !== panel.launches.length ||
      panel.launches.some((recorded, i) => !sameAttempt(recorded, launches[i])))) {
    throw new RangeError('Completed panel ledger cannot be reset, reordered or reassigned');
  }
  if (panel) {
    launches = launches.map((completion, index) => {
      const recorded = panel.launches[index];
      if (recorded.valid !== undefined) return recorded;
      const attempt = { ...completion };
      for (const field of ['model', 'effort', 'provider']) {
        const verified = `${field}Verified`;
        if (recorded[verified] === true) {
          attempt[field] = recorded[field];
          attempt[verified] = true;
        }
      }
      for (const field of ['isolated', 'fresh', 'independent']) {
        if (typeof recorded[field] === 'boolean') attempt[field] = recorded[field];
      }
      return attempt;
    });
  }
  const { launched, valid, accepted } = participation(panel?.plan ?? plan, launches,
    panel ? new Set(panel.independentResultIds) : undefined);
  const reasons = [...plan.reasons];
  let tier = plan.tier;
  if (delegated(tier) && (!valid.candidates || !valid.reviewers)) {
    tier = 'mini';
    reasons.push('Missing a valid isolated candidate or fresh independent review; degraded to mini.');
  }
  if (tier === 'mini' && options.miniAvailable === false) {
    tier = 'direct';
    reasons.push('Insufficient time or reasoning for mini; direct fallback preserves uncertainty.');
  }
  const inference = plan.requestedTier === 'super' ? inferenceReceipt(plan, launches, accepted) : undefined;
  if (tier === 'super' && !inference.applied) {
    tier = 'full';
    reasons.push('Super settings or slot coverage not verified; reporting Full with all actual settings and uncertainty.');
  }
  const explorationApplied = plan.explorationActive === true && tier !== 'direct';
  if (plan.explorationActive === true && !explorationApplied) {
    reasons.push('Requested exploration was not applied after direct fallback.');
  }
  if (valid.candidates !== launched.candidates || valid.reviewers !== launched.reviewers) {
    reasons.push(panel ? 'Attempts excluded from the current synthesis remain included in total launches.'
      : 'Failed or invalid worker results remain included in total launches.');
  }
  if (delegated(plan.tier) && (launched.candidates < plan.allocated.candidates || launched.reviewers < plan.allocated.reviewers)) {
    reasons.push(`Participation below planned ${plan.allocated.candidates}+${plan.allocated.reviewers}.`);
  }
  if (valid.candidates > plan.allocated.candidates || valid.reviewers > plan.allocated.reviewers) {
    reasons.push('Actual valid panel exceeds allocated targets; host dispatch did not follow the reference policy.');
  }
  if (delegated(tier) && valid.candidates === 1 && plan.allocated.candidates !== 1) {
    reasons.push('A single valid candidate lacks independent alternative generation.');
  }
  // Final synthesis evidence and all attempted participation are distinct.
  const workerProvenance = provenanceFor(launches);
  return {
    requestedTier: plan.requestedTier, requestedExploration: plan.requestedExploration,
    tier, explorationApplied, targets: { ...plan.targets }, allocated: { ...plan.allocated },
    maxWorkers: plan.maxWorkers, launched, valid, totalLaunches: launches.length,
    provenance: tier === 'mini' ? 'internal-simulation' : tier === 'direct' ? 'none' : provenanceFor(accepted),
    workerProvenance, synthesis: 'coordinator', reusedDecision: plan.reusedDecision,
    showReceipt: plan.invoked || plan.tier !== 'direct' || launches.length > 0,
    reasons,
    ...(inference ? { inference } : {}),
  };
}


function provenanceFor(workers) {
  if (!workers.length) return 'none';
  if (workers.some(worker => worker.isolated !== true)) return 'isolation-unverified';
  if (!workers.every(worker => worker.modelVerified === true && typeof worker.model === 'string' && worker.model.trim())) {
    return 'isolated-models-unverified';
  }
  return new Set(workers.map(worker => worker.model)).size > 1 ? 'verified-distinct-models' : 'isolated-same-model';
}
