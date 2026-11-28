# Eval results

Model: `claude-haiku-5-5` · run 2026-11-28

## Query → filters (93 labelled queries)

| Metric | Result |
|---|---|
| Exact match (every filter and flag right) | **97.8%** |
| Field accuracy (12 filters × 93 queries) | **100.0%** |
| Made-up filters (set when the user didn't ask) | 0.0% |
| Missed filters | 0.0% |
| Clarifying-question decision | 100.0% |
| Soft-preference detection | 98.9% |
| "Not on this marketplace" detection | 98.9% |
| Latency p50 / p95 | 1509 ms / 3140 ms |
| Cost per 1,000 queries | $0.127 |

Exact match by case type: approximate 100.0% (1) · english 100.0% (36) · injection 100.0% (1) · malay 94.1% (17) · manglish 100.0% (2) · many-filters 100.0% (2) · semantic 100.0% (23) · short 100.0% (7) · trap-mismatch 0.0% (1) · trap-units 100.0% (9) · unsupported 100.0% (7) · vague 100.0% (6)

## Soft preference → ranked listings (24 queries)

| Metric | Result |
|---|---|
| Precision@10 (top 10 actually match the intent) | **80.0%** |
| Random baseline (share of matching cars) | 16.8% |
| Lift over random | 4.8× |

## Grounded answers (24 questions)

| Metric | Result |
|---|---|
| Pass rate (right answer, right citations) | **100.0%** |
| Answerable questions answered correctly | 100.0% |
| Unanswerable questions correctly declined | 100.0% |
| Right guide section retrieved (recall@3) | 100.0% |
