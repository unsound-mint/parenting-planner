# Organizer FAQ

Answers from the organizers' "Business Cup 2.0 | FAQ по кейсу" (150 questions, Nov 14 2026), translated and grouped by topic. Duplicate questions are merged; the Q numbers point back to the original. Rules and scoring: [requirements.md](requirements.md).

## What it means for us

- **Paywall is required in practice.** A working paywall with a clear price is the minimum; a pricing page alone is "too little". A Stripe test-mode checkout the jury can complete, with the test card shown on screen, scores higher under "Does it work?" (Q37, Q55, Q67, Q95).
- **Two people, one link.** For a product where two partners act, the jury may open each role in its own window, but the home page must tell them which links to open and in what order (Q52).
- **Label demo data.** Guest mode with seeded data and sped-up time is explicitly fine if it is marked as demo and runs through real logic (Q35, Q66, Q69, Q84).
- **A return mechanic must be built.** At least one, working in the product: a personal plan, progress, reminders. Retention numbers go in the deck. Renewal matters more than daily use (Q30, Q72, Q100).
- **Health topics are allowed but careful.** No medical recommendations, no promises of treatment, no health data beyond what the flow needs (Q78, Q138, Q150). Our plan items must read as "guideline says, ask your doctor", never as advice.
- **One user, one pain.** A product "about everything at once" usually loses on Problem & user. Pick one main track and one core pain for the pitch; the rest is roadmap (Q10, Q62, Q80, Q101). New parents are named as an example segment (Q13).
- **Depth beats originality.** Product is 40%, originality 10%. A strong product in an existing niche with a new angle beats an original idea that does not work (Q146).
- **Hide dead buttons.** Only the main flow has to work; remove buttons that go nowhere (Q85).
- **README should list key dependencies** (AI models, external APIs) (Q48).

## Logistics and dates

- Deadline 12:00, Nov 15. The jury reviews in the browser between the deadline and 15:00; mobile-adaptive is a plus (Q70, Q103).
- Top 10 are chosen from the submission alone, announced Nov 15 at 15:00 in the Telegram channel @business_cup_2026. Finals at 16:30 in Green Hall: 5 minutes pitch plus 2 minutes questions (Q45, Q70, Q77).
- The production link must stay live at least until the end of the final on Nov 15 (Q47, Q73, Q103).
- The captain submits through the link sent by email: deck PDF, product link, public GitHub link. No pull request needed (Q82, Q104). Solo teams choose "solo" (Q107).
- Questions only through the organizers' form, until 14:00 Nov 14, so all teams get the same answers (Q122).
- Every complete submission gets a participation certificate; only the top 10 are ranked publicly (Q19).
- No mentors or mandatory checkpoints during the 24 hours (Q82).

## Product and engineering

- A deployed, public product the jury uses end to end in the browser with no sign-up. Any host, any domain, including free subdomains like vercel.app. A local server, a Figma link or a demo video do not count (Q1, Q47, Q111).
- Only the key scenario must work, for real, with no stubs or hardcoded answers. "Hardcoded" means the result is written in advance and does not depend on input. One feature that works beats ten buttons that go nowhere (Q3, Q66, Q84).
- Seed or demo databases are fine. Built-in sample inputs are fine if they go through the same live pipeline and are labelled as samples. The flow must also work on the jury's own input; they will try their own data and read the code (Q84, Q94, Q96, Q127, Q134).
- Accounts may exist, but the jury must get through the main flow with a one-click guest or demo mode. Optional accounts are fine. localStorage and anonymous sessions are fine (Q54, Q65, Q68, Q92, Q99, Q119, Q135, Q139).
- Payments: no real payments needed. A paywall with a clear price is the minimum; Stripe test mode is a plus; a model only described in the deck is weaker. Real payments are allowed but the team is responsible for them, and the jury must still pass without paying. Subscription is not mandatory; any model where the user pays works (Q20, Q37, Q51, Q55, Q67, Q91, Q95, Q115, Q116, Q130, Q137).
- Web only means it runs in a browser, desktop or mobile. A PWA counts. A native app (Swift, .ipa, .apk) is an automatic fail. A browser extension is risky; fine only as an extra if the core flow works on the site (Q40, Q60, Q87).
- UI must be in English (Q75).
- Any stack, no architecture standards. They read the code: keep it clean and readable. Simple and working beats complex and unfinished. CI and automated tests are not required; a short README with setup is a plus (Q22, Q23, Q28).
- AI is optional and judged only by user value. AI coding tools, paid APIs, public datasets and own models are allowed; the team pays for API costs. LLM output counts as real if it runs live on user input. The product must be more than a wrapper: structured path, accumulated user data, personalization over time, mechanics. "Our code computes, an LLM explains" counts as real (Q25, Q32, Q36, Q56, Q63, Q89, Q90, Q96, Q128, Q131, Q136).
- Templates, open-source libraries and generic boilerplate are allowed, but the product itself must be built during the hackathon; they may look at the commit history (Q64, Q93, Q98).
- Security: no special requirements, encryption optional. Keep secrets out of the repo and server-side, and do not collect unnecessary personal data (Q26, Q48).
- The repo must be public at submission and contain the full source of what is deployed. A separate private working repo is allowed. Any license or none (Q46, Q61).
- No page count limits; one page is fine (Q114).

## Audience, tracks and B2C

- The user is a US adult aged 25 to 45. Others may use it, but the problem, user, prices and pitch must be built around that audience at the time of the pitch. A Kazakhstan problem is fine only if the same pain exists in the US (Q6, Q29).
- A product for teenagers or children works if a US parent aged 25 to 45 pays; the parent is the customer (Q43).
- Pick one of three tracks: Money, Entertainment, Skills. They are broad. Skills means what adults try to master and keep failing at; career growth fits. Money covers any consumer money pain, including couples' and family budgets (Q4, Q11, Q15, Q21, Q133).
- Choosing the segment (for example nurses, truck drivers, new parents) is part of the task and scored under Problem & user (Q13, Q112).
- B2C means the person pays. If an employer, school or company pays, it is B2B and fails. Freelancers paying themselves are B2C. Partner revenue (for example a bank commission) is fine as an extra source if users themselves pay. A roadmap slide may mention B2B later (Q38, Q42, Q83, Q129).
- Not allowed: 18+ content, real-money gambling, illegal products (Q5, Q110, Q113).
- A physical component may be in the business model, but only the web product is judged (Q44).

## Originality

- Not a ban on categories. A copy is the same audience, the same mechanic and the same value; a mobile app moved to the web unchanged is a copy. A new audience, mechanic or value counts as a new angle; a new acquisition channel alone does not (Q24, Q31, Q57, Q71, Q79, Q97, Q123).
- Do not copy Zimran's own products (Finelo, Coursiv), but their niches are fine (Q12, Q31, Q57).
- A B2C version of a product sold only to employers (examples given: Nayya, ALEX) counts as a new angle (Q147).
- One profession, one pain, a deep solution and a reasoned expansion path is a good strategy (Q124).

## Deck and pitch

- Up to 10 slides total, including the title and any appendix. English, PDF. Extra detail goes in the README (Q53, Q81).
- No separate deck criteria; it is judged on the case criteria. Show the problem and user, the product and main flow, what they pay for and how much, why they come back, business potential, and what is different (Q86, Q141).
- No video: animations do not work in PDF. Show the product with screenshots of key screens and the flow (Q76, Q121, Q145).
- Numbers expected: price, CAC assumptions by channel, retention, LTV, with sources or clear reasoning. Full TAM/SAM/SOM and a detailed financial model are not required. Use public benchmarks such as RevenueCat and Adapty reports; Zimran does not share internal data (Q33, Q58, Q81, Q120, Q142).
- Marketing and acquisition strategy with its cost is a plus for Business potential; logic matters more than budget size (Q143, Q144).
- Seasonal products: an annual plan or one-time payment is fine if it is clear why the user returns next season (Q148).
- The pitch itself may be in Kazakh, Russian or English; only the deck must be in English (Q8, Q75, Q109, Q140).

## Evidence and validation

- Clearly labelled hypotheses with sources are enough. Real interviews, surveys, US user visits, feedback or test payments during the 24 hours are a plus for Problem & user; say clearly what is real and what is a test (Q39, Q49, Q74, Q102, Q149).
- A flow where the user first gets something wrong, trains, then solves a similar task alone is strong evidence of value (Q126).
- Before submitting, go through the main flow yourself on the live link as if you were the jury (Q118).
- What they want from a winner: maximum effort and ownership on every criterion, not looking for what can be skipped (Q117).
