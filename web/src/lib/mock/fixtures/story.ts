import type { Story, StoryMoment } from "@/lib/api/types";
import { mock } from "../registry";
import { couple, dayOf } from "../timeline";

// Preview of Our story for the pregnancy demo (Emily and Jake, week 25), built
// from the same timeline as the other mocks: the key weeks from the due date,
// the lessons, names and talk in fixtures/learn.ts, and the past OB visit the
// real seed stores two weeks ago. It is used only while the endpoint answers
// 501; the real API builds the book from the database (api/internal/story).
const CHECKED = "2026-11-14";
// The size pages in api/internal/content/size_weeks.json.
const nhs = (week: number) => ({
  title: `NHS Start for Life: Week ${week}, week-by-week guide to pregnancy`,
  url: `https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/${week <= 12 ? "1st" : week <= 26 ? "2nd" : "3rd"}-trimester/week-${week}/`,
  checkedAt: CHECKED,
});

// Week w of a pregnancy at week 25 today starts (25 - w) weeks ago.
const weekDay = (w: number) => dayOf(-(25 - w) * 7);

export const storyMocks = {
  ...mock("/members/{memberId}/story", "get", async (ctx) => {
    const { mother, partner } = couple(await ctx.family());
    const both = [mother.id, partner.id];
    const week = (w: number, comparison: string, title?: string): StoryMoment => ({
      id: `week-${w}`, kind: "pregnancy_week", on: weekDay(w), week: w, comparison,
      title: title ?? `About the size of ${comparison}`, peopleIds: [], sources: [nhs(w)],
    });
    const story: Story = {
      chapters: [
        {
          kind: "trimester_1", title: "The secret weeks", span: "Weeks 1 to 13", stage: "pregnancy", current: false,
          startsOn: weekDay(0), endsOn: dayOf(-(25 - 14) * 7 - 1), comparison: "a peach",
          moments: [week(8, "a raspberry"), week(12, "a plum", "End of the first trimester, about the size of a plum")],
        },
        {
          kind: "trimester_2", title: "Getting to know you", span: "Weeks 14 to 27", stage: "pregnancy", current: true,
          startsOn: weekDay(14), comparison: "a zucchini",
          moments: [
            week(16, "an avocado"),
            { id: "lesson-visit-rhythm", kind: "lesson_read", on: dayOf(-62), title: "You both read “The rhythm of prenatal visits”", peopleIds: both },
            week(20, "a banana", "Halfway there, about the size of a banana"),
            { id: "visit-ob", kind: "appointment", on: dayOf(-14), title: "OB visit with Dr. Shah", peopleIds: [mother.id] },
            { id: "talk-p08", kind: "couple_talk", on: dayOf(-6), title: "You talked about it", quote: "What did your parents get right? What do you want to do differently?", peopleIds: both },
            { id: "names", kind: "names_liked", on: dayOf(-5), title: "You both like Ada, June and Theo", detail: "Names on your shared list that both of you liked.", count: 3, names: ["Ada", "June", "Theo"], peopleIds: both },
            week(24, "an ear of corn"),
            { id: "lesson-pain-relief", kind: "lesson_read", on: dayOf(-1), title: `${partner.displayName} read “Pain relief: the options”`, peopleIds: [partner.id] },
          ],
        },
      ],
      next: [
        { kind: "pregnancy_week", title: "week 28 begins, about the size of an eggplant", on: weekDay(28) },
        { kind: "baby_home", title: "your baby comes home" },
        { kind: "quiz_compared", title: "you both answer a lesson's quiz and compare" },
        { kind: "journal", title: "one of you shares a journal line with the other" },
      ],
    };
    return story;
  }),
};
