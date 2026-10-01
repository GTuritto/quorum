# Quorum Deliberation

Extends the loaded core protocol; load only at its declared feature gate.

```sudo
Quorum {
  Candidate { id; proposal?; evidence=[]; assumptions=[]; uncertainties=[]; options?; provenance }
  Option {
    id; kind=baseline|exploratory; proposal; mechanism; expectedBenefit
    evidenceOrAnalogy=[]; materialAssumptions=[]; constraints=[]; uncertainties=[]
    validationExperiment? { assumptionTested; supportingObservation; rejectingObservation; expectedEffort? }
  }
  Review {
    exactlyOne(candidateId, optionId); supportedClaims=[]; unsupportedClaims=[]
    failureConditions=[]; materialRisks=[]; missedConsiderations=[]; ranking?
  }
  Dissent { finding; materiality; disposition=adopted|mitigated|deferred|rejected; reconsiderationTrigger? }
  Generation {
    exploration => generate before evaluation: baseline + two materially different exploratory alternatives when useful/feasible
    idea count != worker count; exploration never changes worker allocation; no padded weak options
    generate Option bundles; record mechanisms, benefits, evidence vs analogy, material assumptions, constraints, testable uncertainty
    each option requires validationExperiment: assumption + observable support/rejection + effort when estimable
    label speculation + unknown feasibility; never fabricate evidence, research, novelty, or feasibility
    constraint-relaxing options => conditional pending user agreement; never a feasible current winner
    generators: problem + minimum necessary context + distinct frame + schema; no ranking/evaluation/winner
    inactive exploration => Candidate proposals; mini uses separate lens perspectives in one context
    full generators: isolated, no peer outputs/communication, no tools/mutations, no recursive Quorum/ADHD
    stop adding candidates when assumptions repeat; disclose reduced panel
  }
  Anonymize {
    inactive => opaque randomized candidate IDs; remove unnecessary author/frame identifiers
    active => flatten options; opaque randomized option IDs; remove author + frame clues from metadata and wording
    keep private source mapping; reviewers get only required context + anonymous content + stable rubric
  }
  ReviewPolicy {
    generate all before review; no candidates after review starts
    fresh independent reviewer != generator; no peer reviews before own submission
    one reviewer => all lenses; multiple => collective coverage of all three under same rubric
    judge claims/artifacts, never author; record agreement/disagreement + unsupported claims + missed considerations
    check factual entailment: labels do not prove operational preconditions (single-user/offline != single-writer); missing preconditions remain assumptions + failure conditions
    rubric=[correctness, completeness, evidence, consistency, usefulness, uncertainty, failureConditions, risk]
    explorationRubric=[usefulness, originalityRelativeToBaseline, feasibility, cost, risk]
    review candidateId when inactive; optionId when active; never both
    failed lens coverage => disclose; do not claim complete coverage
  }
  Synthesis {
    mini: internal-simulation, not independent model evidence; generate then review then synthesize here
    full: valid anonymous candidates/options -> independent reviews -> coordinator synthesis
    rank using stable valid reviews without role preference; combine supported insights, do not copy top rank
    resolve only evidence-supported disagreements; retain material dissent + viable minority findings
    audit accepted claims against original facts/evidence; reviewer agreement != verification; never promote assumptions to facts or dismiss unexcluded failure modes
    retain unknowns; prefer practical/reversible choices when otherwise comparable
    exploration => grounded recommendation + worthwhile alternatives + smallest actionable validation experiment
    test states assumption, observable support/rejection, effort when estimable; weak support => recommend experiment
    keep hypotheses labeled, not facts; hard constraints remain binding
    emit concise Decision + useful reasoning + material risks/dissent + next action/confidence when helpful
    no hidden deliberation; no duplicate ADHD scoring/clustering/deepening unless separately requested
  }
  Failure {
    full: insufficient cap/capacity/isolation/valid independent review => mini, disclose reason
    mini: insufficient reasoning/time budget => direct, disclose unresolved uncertainty
    fallback retains launch ledger + worker provenance; never turn spent launches into zero
    final direct with requested exploration => disclose incomplete exploration when material
    never imply fallback resolves consequential risk; unsupported authority => stop affected action
  }
}
```
