package couplelab

// The scenario cards. Each is a short situation with three or four answers and
// always a fifth, "Something else", added by the API (choice id "other").
// Prompt is the conversation starter shown when the two answers differ; it is
// worded as a question to explore, never as who is right. Nothing here is
// scored: the lab finds subjects to talk about, not a compatibility result.
//
// Cards are not health guidance, so they carry no source.

type Choice struct{ ID, Label string }

type Card struct {
	ID, Topic, Situation, Prompt string
	Choices                      []Choice
}

const (
	TopicNights    = "Night shifts"
	TopicRelatives = "Relatives and visits"
	TopicChildcare = "Childcare"
	TopicValues    = "Parenting values"
	TopicMoney     = "Money"
	TopicUs        = "You two"
)

func c(id, topic, situation, prompt string, choices ...string) Card {
	cs := make([]Choice, len(choices))
	for i, l := range choices {
		cs[i] = Choice{ID: string(rune('a' + i)), Label: l}
	}
	return Card{ID: id, Topic: topic, Situation: situation, Prompt: prompt, Choices: cs}
}

// Cards in the order the screen offers them: topics are mixed so a session
// never feels like one long money talk.
var Cards = []Card{
	c("night-split", TopicNights, "It is 2 a.m. and the baby wakes for the third time. You both have work in the morning. What feels fair?",
		"How could we split the nights so each of us gets one long stretch of sleep, and what would we change if it stopped working?",
		"We take turns, night by night", "Whoever is awake gets up", "One of us covers weeknights, the other weekends", "We both get up, to keep each other company"),
	c("visitors-first-weeks", TopicRelatives, "Both grandmothers want to stay for a week once the baby is born. How do you picture the first weeks?",
		"What do we each want the first weeks to look like, and who tells the grandparents what we decided?",
		"Just us for the first two weeks, then visits", "Family helps from day one", "Short visits with a clear end time", "Whoever we feel like having, week by week"),
	c("childcare-when", TopicChildcare, "Parental leave is ending. What do you imagine for the day-to-day care?",
		"Which of these feels right to each of us, and what would make us change the plan?",
		"One of us stays home a while longer", "Daycare or a nursery", "A nanny or relatives at home", "We split the week between work and home"),
	c("values-crying", TopicValues, "A toddler melts down in the supermarket queue. Your first instinct is...",
		"What does a good response look like to each of us, and where did that idea come from?",
		"Stay calm and wait it out", "Take them outside and talk it through", "Give a clear limit and follow through", "Distract them with something else"),
	c("money-baby-budget", TopicMoney, "A stroller you both like costs three times the plain one. How do you decide on baby purchases?",
		"How do we want to decide on spending for the baby, and is there an amount where we check with each other first?",
		"Set a monthly baby budget and stay within it", "Buy the safe, long-lasting thing even if it costs more", "Borrow or buy second hand where we can", "Decide case by case, no fixed rule"),
	c("us-time", TopicUs, "Three months in, you have not had an evening alone. What do you want to do about it?",
		"What would time for just the two of us look like, and what would help us protect it?",
		"Plan a regular date night, even a short one", "Wait until the baby sleeps better", "Take turns having time to ourselves", "Fit it in while the baby naps"),
	c("night-who-soothes", TopicNights, "The baby cries and both of you are awake. One of you soothes better. What happens?",
		"Do we want to share the hard moments evenly, or lean on whoever is better at them right now?",
		"The better soother takes it", "We swap after ten minutes", "The one who had more sleep takes it", "We handle it together"),
	c("relatives-advice", TopicRelatives, "A relative keeps giving advice you did not ask for. How do you respond?",
		"How do we want to handle advice from family, and who speaks up when it is about our parenting?",
		"Thank them and do it our way", "Talk to them kindly but directly", "Ask the one whose relative it is to handle it", "Listen, since it comes from care"),
	c("childcare-sick-day", TopicChildcare, "The child wakes with a fever and you both have an important day. What now?",
		"How do we want to share unplanned days off, and how do we keep it from always falling on one of us?",
		"Whoever has the lighter day stays home", "We alternate sick days", "One of us is the default", "We call a relative first"),
	c("values-screens", TopicValues, "How do you see screens for a young child?",
		"Where do we each draw the line on screens, and what would we do on a very hard day?",
		"As little as possible", "Fine for some shows, with limits", "A useful tool when we need a break", "We decide as the child grows"),
	c("money-save", TopicMoney, "You get an unexpected bonus. What should happen to it?",
		"What matters most for the family's money in the next year, and what is one thing we would each like to protect?",
		"Save it for the child's future", "Pay down debt or build an emergency fund", "Spend some on help at home", "Enjoy part of it now, save the rest"),
	c("us-disagree", TopicUs, "You disagree about something small and you are both tired. What usually works?",
		"What helps each of us when we disagree while tired, and what makes it harder?",
		"Pause and come back to it later", "Talk it out right away", "Write it down and discuss it calmly", "Let it go unless it keeps coming back"),
	c("nights-feeding", TopicNights, "Feeding at night: how would you like to support each other?",
		"What would help the person feeding at night feel supported, and what would help the other one stay rested?",
		"The other parent does the changes and burps", "Take turns with a bottle if that works for us", "One of us rests fully, the other covers", "Stay up together for the first weeks"),
	c("relatives-holidays", TopicRelatives, "The holidays are coming and both families want you with them. What do you do?",
		"How do we want to share holidays between families, and what would we like to start as our own tradition?",
		"Alternate families each year", "Split the day between both", "Host at our home", "Take a quiet holiday for ourselves"),
	c("childcare-who-decides", TopicChildcare, "Choosing a doctor, daycare or school. Who leads?",
		"Who leads on which decisions for the child, and how do we make sure the other still has a say?",
		"We decide everything together", "Each of us leads on a few areas", "The one with more time researches, then we agree", "Whoever feels strongest about it"),
	c("values-bedtime", TopicValues, "Bedtime for an older baby: crying at the cot. How do you feel about it?",
		"What do we each feel is okay at bedtime and what is not, and how would we try something new together?",
		"Always respond quickly", "Give a few minutes first", "Follow a gentle method together", "Whatever the baby's pattern needs"),
	c("money-income", TopicMoney, "One of you could earn less or pause work for a while. How would you want to handle it?",
		"What would feel fair if one income dropped, and how would we say so if it did not feel fair?",
		"Share the money as ours, whoever earns it", "Keep some money separate for each of us", "Review it together every few months", "Plan it carefully before it happens"),
	c("us-roles", TopicUs, "Who should handle the invisible tasks: doctor visits, gifts, forms, packing the bag?",
		"Which of these tasks would each of us like to take, and how do we notice when one of us carries too many?",
		"We list them and split it", "The one who notices does it", "Each of us owns certain tasks fully", "We ask each other as it comes"),
	c("relatives-boundaries", TopicRelatives, "A grandparent wants to babysit alone from the start. How do you feel?",
		"What are we each comfortable with before the baby stays with someone else, and what helps us feel safe about it?",
		"Yes, they are family and we trust them", "Yes, after a few visits together", "Not for the first months", "Only for short times, nearby"),
	c("values-future", TopicValues, "What do you most want your child to grow up feeling?",
		"What do we each want our child to remember about their childhood, and what do we do now to build that?",
		"Safe and loved, whatever happens", "Curious and free to try things", "Kind and caring toward others", "Confident and able to look after themselves"),
	c("childcare-leave", TopicChildcare, "Parental leave. How would you like to use it?",
		"How do we want to use leave so both of us bond with the baby, and what would that do to work and money?",
		"Both of us take leave at the same time", "One after the other", "Mostly one of us, as much as possible", "We have not decided and need facts"),
}

// ByID finds a card.
func ByID(id string) (Card, bool) {
	for _, card := range Cards {
		if card.ID == id {
			return card, true
		}
	}
	return Card{}, false
}

// ValidChoice reports whether id is one of the card's answers or "other".
func ValidChoice(card Card, id string) bool {
	if id == Other {
		return true
	}
	for _, ch := range card.Choices {
		if ch.ID == id {
			return true
		}
	}
	return false
}

// Other is the id of "Something else".
const Other = "other"
