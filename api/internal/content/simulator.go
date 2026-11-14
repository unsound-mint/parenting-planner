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
		{
			ID: "feed-full", Skill: "feeding",
			Prompt:        "Halfway through a bottle, your 6-week-old closes their mouth and turns their head away. What is the likely message?",
			Choices:       []PracticeChoice{{"a", "They may be full, so pause and let them stop"}, {"b", "They need to finish the bottle no matter what"}, {"c", "They are hungry for more"}},
			CorrectChoice: "a",
			Explanation:   "Closing the mouth, turning the head away from the breast or bottle and relaxing the hands can be signs a young baby is full.",
			Source:        practiceSource("CDC: Signs Your Child Is Hungry or Full", "https://www.cdc.gov/infant-toddler-nutrition/mealtime/signs-your-child-is-hungry-or-full.html"),
		},
		{
			ID: "feed-early", Skill: "feeding",
			Prompt:        "When is a good time to start a feed?",
			Choices:       []PracticeChoice{{"a", "Only once the baby is crying hard"}, {"b", "When early cues show, like hands to the mouth or clenched hands"}, {"c", "Strictly every four hours, whatever the cues"}},
			CorrectChoice: "b",
			Explanation:   "Hands to the mouth and clenched hands can be hunger cues. Crying is often a late sign of hunger.",
			Source:        practiceSource("CDC: Signs Your Child Is Hungry or Full", "https://www.cdc.gov/infant-toddler-nutrition/mealtime/signs-your-child-is-hungry-or-full.html"),
		},
		{
			ID: "room-share", Skill: "safe_sleep",
			Prompt:        "Where is the safest place for the baby's crib or bassinet at night?",
			Choices:       []PracticeChoice{{"a", "In your bedroom, on a separate sleep surface"}, {"b", "In your bed between the two of you"}, {"c", "In a room down the hall"}},
			CorrectChoice: "a",
			Explanation:   "Room sharing reduces the risk of SIDS and sleep-related deaths. It is safer than bed sharing and safer than the baby sleeping in their own room.",
			Source:        practiceSource("NICHD: Safe to Sleep", "https://safetosleep.nichd.nih.gov/reduce-risk/safe-sleep-environment"),
		},
		{
			ID: "car-seat-nap", Skill: "safe_sleep",
			Prompt:        "The baby fell asleep in the car seat on the way home. What now?",
			Choices:       []PracticeChoice{{"a", "Leave them in the car seat for the whole nap"}, {"b", "Move them to their crib or bassinet, on their back"}, {"c", "Prop the car seat on the sofa"}},
			CorrectChoice: "b",
			Explanation:   "Car seats, strollers and other sitting devices are not recommended as a baby's regular sleep or nap space.",
			Source:        practiceSource("NICHD: Safe to Sleep", "https://safetosleep.nichd.nih.gov/reduce-risk/safe-sleep-environment"),
		},
		{
			ID: "soft-things", Skill: "safe_sleep",
			Prompt:        "A friend gave you crib bumpers and a plush toy. Where do they go?",
			Choices:       []PracticeChoice{{"a", "In the crib, so it feels cosy"}, {"b", "Bumpers in, toy out"}, {"c", "Out of the sleep area"}},
			CorrectChoice: "c",
			Explanation:   "Soft items such as pillows, stuffed toys and crib bumpers are best kept out of the baby's sleep area.",
			Source:        practiceSource("NICHD: Safe to Sleep", "https://safetosleep.nichd.nih.gov/reduce-risk/safe-sleep-environment"),
		},
		{
			ID: "rash-care", Skill: "diapering",
			Prompt:        "You notice a mild red diaper rash. What helps?",
			Choices:       []PracticeChoice{{"a", "Change diapers often, let the skin air-dry, then use a zinc oxide or petrolatum cream"}, {"b", "Scrub the area with scented wipes"}, {"c", "Change diapers less often so the skin rests"}},
			CorrectChoice: "a",
			Explanation:   "Change diapers frequently, pat gently and let the skin air-dry. Zinc oxide and petrolatum are good choices; fragrance-free products are best.",
			Source:        practiceSource("AAP: Diaper Rash", "https://www.healthychildren.org/English/ages-stages/baby/diapers-clothing/Pages/Diaper-Rash.aspx"),
		},
		{
			ID: "rash-blisters", Skill: "diapering",
			Prompt:        "The diaper rash now has blisters and oozing sores. What is the next step?",
			Choices:       []PracticeChoice{{"a", "Keep using the same cream and wait a week"}, {"b", "Call the pediatrician"}, {"c", "Stop using diapers"}},
			CorrectChoice: "b",
			Explanation:   "Blisters, pimples, peeling skin or pus-filled, oozing or crusty sores are reasons to call the pediatrician.",
			Source:        practiceSource("AAP: Diaper Rash", "https://www.healthychildren.org/English/ages-stages/baby/diapers-clothing/Pages/Diaper-Rash.aspx"),
		},
		{
			ID: "rash-days", Skill: "diapering",
			Prompt:        "You have treated a diaper rash for three days and it is getting worse. What do you do?",
			Choices:       []PracticeChoice{{"a", "Call the pediatrician"}, {"b", "Switch to a stronger scented cream"}, {"c", "Ignore it, rashes always pass"}},
			CorrectChoice: "a",
			Explanation:   "Call the pediatrician if the rash is not going away or is getting worse after two to three days of treatment, or if the baby also has a fever.",
			Source:        practiceSource("AAP: Diaper Rash", "https://www.healthychildren.org/English/ages-stages/baby/diapers-clothing/Pages/Diaper-Rash.aspx"),
		},
		{
			ID: "jaundice-wake", Skill: "warning_signs",
			Prompt:        "Your 5-day-old looks more yellow than yesterday and is hard to wake for feeds. What is the next step?",
			Choices:       []PracticeChoice{{"a", "Call the pediatrician"}, {"b", "Put the baby by the window and wait"}, {"c", "Skip feeds until they wake on their own"}},
			CorrectChoice: "a",
			Explanation:   "Skin turning more yellow, or a baby who is hard to wake or not feeding well, are reasons to call the pediatrician.",
			Source:        practiceSource("AAP: Jaundice in Newborns", "https://www.healthychildren.org/English/ages-stages/baby/Pages/Jaundice.aspx"),
		},
		{
			ID: "jaundice-spread", Skill: "warning_signs",
			Prompt:        "The yellow colour has spread from the face to the baby's tummy and legs. What should you do?",
			Choices:       []PracticeChoice{{"a", "Nothing, it always spreads"}, {"b", "Call the pediatrician"}, {"c", "Give water between feeds"}},
			CorrectChoice: "b",
			Explanation:   "Yellow skin on the abdomen, arms or legs is a reason to call the pediatrician.",
			Source:        practiceSource("AAP: Jaundice in Newborns", "https://www.healthychildren.org/English/ages-stages/baby/Pages/Jaundice.aspx"),
		},
		{
			ID: "calm-womb", Skill: "soothing",
			Prompt:        "The baby is fed, changed and still fussy. Which of these might help?",
			Choices:       []PracticeChoice{{"a", "Swaddle in a large thin blanket and turn on a calming sound like white noise"}, {"b", "Turn on every light and the TV"}, {"c", "Leave them alone in a dark room for an hour"}},
			CorrectChoice: "a",
			Explanation:   "Swaddling in a large, thin blanket and sounds that remind babies of the womb, such as white noise, may be calming.",
			Source:        practiceSource("AAP: How to Calm a Fussy Baby", "https://www.healthychildren.org/English/ages-stages/baby/crying-colic/Pages/Calming-A-Fussy-Baby.aspx"),
		},
		{
			ID: "calm-motion", Skill: "soothing",
			Prompt:        "Swaddling did not settle the baby. What else can you try?",
			Choices:       []PracticeChoice{{"a", "Bounce the baby hard to distract them"}, {"b", "Walk with the baby in a carrier or rock them"}, {"c", "Leave them to cry alone for hours"}},
			CorrectChoice: "b",
			Explanation:   "Walking the baby in a body carrier or rocking them can calm a baby: those motions remind babies of the womb.",
			Source:        practiceSource("AAP: How to Calm a Fussy Baby", "https://www.healthychildren.org/English/ages-stages/baby/crying-colic/Pages/Calming-A-Fussy-Baby.aspx"),
		},
		{
			ID: "handoff-note", Skill: "teamwork",
			Prompt:        "You are handing the night over at 2 am. What helps your partner most?",
			Choices:       []PracticeChoice{{"a", "A quick note: last feed, last diaper and anything unusual"}, {"b", "Nothing, they will figure it out"}, {"c", "A long talk while the baby waits"}},
			CorrectChoice: "a",
			Explanation:   "A short handover with the last feed, last diaper and anything unusual means the next person does not have to guess.",
		},
		{
			ID: "protect-sleep", Skill: "teamwork",
			Prompt:        "One of you has slept two hours in two days. What is a fair plan for tonight?",
			Choices:       []PracticeChoice{{"a", "Both stay up for every wake-up"}, {"b", "The rested one covers a block so the other gets a long stretch of sleep"}, {"c", "Whoever complains less does the night"}},
			CorrectChoice: "b",
			Explanation:   "Taking turns in blocks gives each of you a protected stretch of sleep instead of two broken nights.",
		},
	}
}

func PracticeScenarios() []PracticeScenario {
	return []PracticeScenario{
		{ID: "first-night-home", Title: "The first night home", Summary: "Practice feeding cues, safe sleep and when to call the pediatrician.", Questions: []string{"feed-cues", "safe-surface", "fever"}, Shift: PracticeShift{"Night feeds", "22:00", "02:00", []string{"mon", "tue", "wed", "thu", "fri"}}},
		{ID: "crying-and-sharing", Title: "Crying and sharing the night", Summary: "Practice responding to crying and agreeing who is on duty.", Questions: []string{"cry-soothe", "calm-womb", "calm-motion", "split-nights", "handoff-note"}, Shift: PracticeShift{"Early morning shift", "05:00", "08:00", []string{"mon", "wed", "fri"}}},
		{ID: "first-week-checks", Title: "The first week: feeds and checks", Summary: "Practice reading hunger and fullness, and spotting jaundice that needs a call.", Questions: []string{"feed-early", "feed-full", "jaundice-wake", "jaundice-spread"}, Shift: PracticeShift{"Daytime feeds and checks", "08:00", "12:00", []string{"sat", "sun"}}},
		{ID: "naps-and-diapers", Title: "Naps, outings and diapers", Summary: "Practice safe naps away from the crib and caring for diaper rash.", Questions: []string{"room-share", "car-seat-nap", "soft-things", "rash-care", "rash-blisters", "rash-days", "protect-sleep"}, Shift: PracticeShift{"Evening bath and bed", "18:00", "21:00", []string{"tue", "thu", "sat"}}},
	}
}
