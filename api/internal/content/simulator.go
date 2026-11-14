package content

import "time"

type PracticeChoice struct {
	ID, Text string
}

type PracticeQuestion struct {
	ID, Skill, Prompt string
	Choices           []PracticeChoice
	CorrectChoice     string
	Explanation       string
	Source            *Source
}

type PracticeShift struct {
	Title, Start, End string
	Days              []string
}

type PracticeScenario struct {
	ID, Title, Summary string
	Questions          []string
	Shift              PracticeShift
}

func practiceSource(title, url string) *Source {
	return &Source{Title: title, URL: url, CheckedAt: time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)}
}

func PracticeQuestions() []PracticeQuestion {
	return []PracticeQuestion{
		{
			ID: "feed-cues", Skill: "feeding",
			Prompt:        "Your newborn smacks their lips and turns toward the bottle. What might that mean?",
			Choices:       []PracticeChoice{{"a", "They may be hungry"}, {"b", "They are definitely full"}, {"c", "They only show hunger by crying"}},
			CorrectChoice: "a",
			Explanation:   "Lip smacking and turning toward a breast or bottle can be signs of hunger.",
			Source:        practiceSource("CDC: Signs Your Child Is Hungry or Full", "https://www.cdc.gov/infant-toddler-nutrition/mealtime/signs-your-child-is-hungry-or-full.html"),
		},
		{
			ID: "safe-surface", Skill: "safe_sleep",
			Prompt:        "It is 3 am. Where should the baby sleep after a feed?",
			Choices:       []PracticeChoice{{"a", "On the sofa beside me"}, {"b", "On their back in an empty crib or bassinet"}, {"c", "On a pillow on their tummy"}},
			CorrectChoice: "b",
			Explanation:   "Use a firm, flat, level sleep surface and place the baby on their back. Keep soft bedding out of the sleep space.",
			Source:        practiceSource("NICHD: Safe to Sleep", "https://safetosleep.nichd.nih.gov/reduce-risk/safe-sleep-environment"),
		},
		{
			ID: "fever", Skill: "warning_signs",
			Prompt:        "Your 3-week-old has a rectal temperature of 100.6 °F (38.1 °C). What is the next step?",
			Choices:       []PracticeChoice{{"a", "Wait until morning"}, {"b", "Call the pediatrician immediately"}, {"c", "Wait for other symptoms"}},
			CorrectChoice: "b",
			Explanation:   "For a baby 3 months old or younger, a rectal temperature of 100.4 °F (38 °C) or higher is a reason to call the pediatrician immediately.",
			Source:        practiceSource("AAP: Fever and Your Baby", "https://www.healthychildren.org/English/health-issues/conditions/fever/pages/fever-and-your-baby.aspx"),
		},
		{
			ID: "cry-soothe", Skill: "soothing",
			Prompt:        "The baby keeps crying and you feel yourself getting overwhelmed. What can you do?",
			Choices:       []PracticeChoice{{"a", "Keep going without taking a break"}, {"b", "Put the baby in a safe place and step away briefly to calm down"}, {"c", "Wake the baby up if they settle"}},
			CorrectChoice: "b",
			Explanation:   "Put the baby in a safe place, take a short break to calm down, and continue checking on them. You can also ask someone you trust for help.",
			Source:        practiceSource("CDC: About Abusive Head Trauma", "https://www.cdc.gov/child-abuse-neglect/about/about-abusive-head-trauma.html"),
		},
		{
			ID: "split-nights", Skill: "teamwork",
			Prompt:        "Both of you are tired and neither is sure who is on duty tonight. What makes the handoff clearer?",
			Choices:       []PracticeChoice{{"a", "Assume whoever wakes first is on duty"}, {"b", "Agree who is on duty and at what time"}, {"c", "Leave a reminder with no owner"}},
			CorrectChoice: "b",
			Explanation:   "Agreeing who takes each shift and when makes it clear who is on duty and when they should hand over.",
		},
	}
}

func PracticeScenarios() []PracticeScenario {
	return []PracticeScenario{
		{ID: "first-night-home", Title: "The first night home", Summary: "Practice feeding cues, safe sleep and when to call the pediatrician.", Questions: []string{"feed-cues", "safe-surface", "fever"}, Shift: PracticeShift{"Night feeds", "22:00", "02:00", []string{"mon", "tue", "wed", "thu", "fri"}}},
		{ID: "crying-and-sharing", Title: "Crying and sharing the night", Summary: "Practice responding to crying and agreeing who is on duty.", Questions: []string{"cry-soothe", "split-nights"}, Shift: PracticeShift{"Early morning shift", "05:00", "08:00", []string{"mon", "wed", "fri"}}},
	}
}
