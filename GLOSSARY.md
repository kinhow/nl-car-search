# NL Car Search

Natural-language search for a used-car marketplace. A buyer types what they want in English, Malay or Manglish, and gets matching listings.

## Search

**Query**:
The text that the buyer types to describe the car that they want.
_Avoid_: Prompt, input, search string

**Filter**:
A hard condition on a listing (make, price, year, state and so on). A listing that fails a filter is not in the results.
_Avoid_: Criteria, constraint

**Preference**:
A soft wish that a filter cannot express, such as "good for Grab". It changes the order of the results, not which listings match.
_Avoid_: Semantic query, soft filter, intent

**Chip**:
One filter or preference that the page shows to the buyer, which the buyer can remove.
_Avoid_: Tag, pill, badge

## How a query is read

**AI search**:
The LLM reads the query and gives the filters and the preference.

**Cached result**:
A query that was read before, so the page uses the same filters and preference again without the LLM.
_Avoid_: Saved search (that name is for demo mode)

**Fast path**:
A simple query that the keyword parser reads with full confidence, so the LLM is not used. This is a choice, not a failure.
_Avoid_: Shortcut, quick mode

**Keyword fallback**:
The keyword parser reads the query because the LLM failed or is off. Results can be less accurate, and the page says so.
_Avoid_: Fast path, basic search

## Timing

**Parse time**:
The time that the LLM uses to turn a query into filters and a preference.
_Avoid_: Search time, latency

**Time to results**:
The time from the moment the buyer starts a search to the moment the results show. This is the time that the buyer feels.
_Avoid_: Search time, response time
