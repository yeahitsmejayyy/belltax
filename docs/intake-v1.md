# Intake questionnaire v1 — DRAFT

Generated from `packages/schema/src/intake/v1.ts` by `bun run intake:doc`. Don't edit by hand.

**For PJ:** check each question against what ProSeries asks. Mark anything missing, unclear or unnecessary,
then we change `v1.ts` and regenerate. By design the portal never asks for a full SSN, an IP PIN or bank
account numbers (WISP §V.1), and refuses free-text answers that look like one.

33 questions in 7 sections; 18 are always required, the rest only when shown or never.

## Your household this year

| Question | Answer | Required | Shown when |
|---|---|---|---|
| Did your marital status change during the year? | yes / no | yes | always |
| What changed? | pick one<br>I got married · I got divorced · We separated · My spouse passed away | yes | "Did your marital status change during the year?" is yes |
| When? | date | no | "Did your marital status change during the year?" is yes |
| Did you move during the year? | yes / no | yes | always |
| Where did you move? | pick one<br>Somewhere else in California · Into California from another state · Out of California | yes | "Did you move during the year?" is yes |
| When did you move? | date | no | "Did you move during the year?" is yes |

## People you support

| Question | Answer | Required | Shown when |
|---|---|---|---|
| Does anyone depend on you for support, like children, a parent or another relative? | yes / no | yes | always |
| Has that changed since last year? For example a birth, an adoption, or someone moving in or out. | yes / no | yes | "Does anyone depend on you for support, like children, a parent or another relative?" is yes |
| Tell us who, and what changed.<br>_Please don't include Social Security, IP PIN or account numbers here. We'll ask for Social Security cards separately._ | free text | yes | "Has that changed since last year? For example a birth, an adoption, or someone moving in or out." is yes |
| Did you pay for childcare or dependent care so you could work? | yes / no | yes | "Does anyone depend on you for support, like children, a parent or another relative?" is yes |
| Is anyone you support a full-time student aged 19 to 23? | yes / no | no | "Does anyone depend on you for support, like children, a parent or another relative?" is yes |

## Your income

_Tick everything that applies to you or your spouse this year._

| Question | Answer | Required | Shown when |
|---|---|---|---|
| Where did your income come from? | pick any<br>A job (Form W-2) · IHSS caregiving · Self-employment, freelancing or gig apps (1099-NEC or 1099-K) · Interest, dividends or selling investments (1099-INT, -DIV, -B) · A pension or retirement account (1099-R) · Social Security (SSA-1099) · Unemployment (1099-G) · Rental property · Something else | yes | always |
| Did you start or leave a job this year? | yes / no | yes | always |
| Do you have a summary of your business expenses (mileage, supplies, phone, home office)? | yes / no | yes | "Where did your income come from?" includes self_employment |
| What was the other income?<br>_Please don't include Social Security, IP PIN or account numbers here._ | free text | yes | "Where did your income come from?" includes other |
| Did you sell a home or other property? | yes / no | yes | always |
| Did you receive, sell, swap or trade cryptocurrency or other digital assets? | yes / no | yes | always |

## Things that might lower your tax

| Question | Answer | Required | Shown when |
|---|---|---|---|
| Did you or someone you support pay college tuition (Form 1098-T)? | yes / no | yes | always |
| Did you pay interest on a student loan (Form 1098-E)? | yes / no | yes | always |
| Did you buy a home? | yes / no | yes | always |
| Do you pay mortgage interest (Form 1098)? | yes / no | yes | always |
| Did you add solar panels, a heat pump or other energy upgrades to your home? | yes / no | no | always |
| Did you buy an electric vehicle? | yes / no | no | always |
| Did you give to charity? | yes / no | no | always |

## Health coverage

| Question | Answer | Required | Shown when |
|---|---|---|---|
| Where did your health coverage come from? | pick one<br>An employer · Covered California (you'll get Form 1095-A) · Medi-Cal · Medicare · I didn't have coverage · Somewhere else | yes | always |
| Was everyone in your household covered for the whole year? | yes / no | yes | always |

## Last year and letters

| Question | Answer | Required | Shown when |
|---|---|---|---|
| Who prepared last year's return? | pick one<br>Bell Tax Prep · Another preparer · I did it myself · I didn't file | yes | always |
| Did you get any letters from the IRS or the California Franchise Tax Board this year? | yes / no | yes | always |
| Did you make estimated tax payments for the year? | yes / no | yes | always |
| About how much, in total? | amount ($) | no | "Did you make estimated tax payments for the year?" is yes |
| Did the IRS send you an Identity Protection PIN (IP PIN)?<br>_Bring the letter to your appointment. Don't type the PIN here._ | yes / no | yes | always |

## Last few things

| Question | Answer | Required | Shown when |
|---|---|---|---|
| If you get a refund, how would you like it?<br>_We collect bank details securely when you sign your return, never in this portal._ | pick one<br>Direct deposit · A paper check · Apply it to next year's taxes | yes | always |
| Anything else we should know, or questions for us?<br>_Please don't include Social Security, IP PIN or account numbers here._ | free text | no | always |
