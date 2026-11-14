package milestones

import (
	"fmt"
	"time"
)

type Item struct {
	ID, Domain, Text string
}

var CheckedAt = time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)

func SourceURL(months int) string {
	return fmt.Sprintf("https://www.cdc.gov/act-early/milestones/%d-years.html", months/12)
}

func Checklist(age int) (int, []Item) {
	for _, months := range []int{60, 48, 36, 24} {
		if age >= months {
			return months, catalog[months]
		}
	}
	return 0, nil
}

const (
	social   = "social_emotional"
	language = "language_communication"
	thinking = "cognitive"
	movement = "movement_physical"
)

var catalog = map[int][]Item{
	24: {
		{"2y-social-notices", social, "Notices when someone is hurt or upset."},
		{"2y-social-face", social, "Looks at your face for cues in an unfamiliar situation."},
		{"2y-language-book", language, "Points to a picture in a book when asked."},
		{"2y-language-words", language, "Puts at least two words together."},
		{"2y-language-body", language, "Points to at least two body parts when asked."},
		{"2y-language-gestures", language, "Uses gestures besides waving and pointing."},
		{"2y-thinking-hands", thinking, "Holds an object with one hand and works with it using the other."},
		{"2y-thinking-controls", thinking, "Tries the buttons or switches on a toy."},
		{"2y-thinking-toys", thinking, "Uses more than one toy together during play."},
		{"2y-movement-kick", movement, "Kicks a ball."},
		{"2y-movement-run", movement, "Runs."},
		{"2y-movement-stairs", movement, "Walks up a few stairs, with or without help."},
		{"2y-movement-spoon", movement, "Uses a spoon to eat."},
	},
	36: {
		{"3y-social-separation", social, "Settles within about ten minutes after you leave, such as at childcare."},
		{"3y-social-join", social, "Notices other children and joins their play."},
		{"3y-language-conversation", language, "Has a conversation with at least two exchanges back and forth."},
		{"3y-language-questions", language, "Asks questions starting with who, what, where, or why."},
		{"3y-language-action", language, "Names an action shown in a picture when asked."},
		{"3y-language-name", language, "Gives their first name when asked."},
		{"3y-language-clear", language, "Speaks so other people usually understand."},
		{"3y-thinking-circle", thinking, "Copies a circle after you show how."},
		{"3y-thinking-hot", thinking, "Keeps away from a hot object when warned."},
		{"3y-movement-string", movement, "Threads objects such as large beads."},
		{"3y-movement-dress", movement, "Puts on some clothes without help."},
		{"3y-movement-fork", movement, "Eats using a fork."},
	},
	48: {
		{"4y-social-pretend", social, "Takes on a pretend role during play."},
		{"4y-social-play", social, "Asks to play with other children when none are nearby."},
		{"4y-social-comfort", social, "Offers comfort when someone is sad or hurt."},
		{"4y-social-danger", social, "Avoids obvious dangers, such as jumping from a great height."},
		{"4y-social-helper", social, "Enjoys helping out."},
		{"4y-social-setting", social, "Acts differently in different settings, such as a library and a playground."},
		{"4y-language-sentences", language, "Uses sentences of at least four words."},
		{"4y-language-song", language, "Says some words from a familiar rhyme, song, or story."},
		{"4y-language-day", language, "Describes something that happened that day."},
		{"4y-language-purpose", language, "Answers simple questions about what everyday objects are for."},
		{"4y-thinking-colors", thinking, "Can name a few colors."},
		{"4y-thinking-story", thinking, "Predicts the next part of a familiar story."},
		{"4y-thinking-person", thinking, "Draws a person with at least three body parts."},
		{"4y-movement-catch", movement, "Usually catches a large ball."},
		{"4y-movement-pour", movement, "Serves food or pours water while an adult supervises."},
		{"4y-movement-unbutton", movement, "Can undo some buttons."},
		{"4y-movement-pencil", movement, "Grips a pencil or crayon with fingers and thumb."},
	},
	60: {
		{"5y-social-turns", social, "Takes turns or follows rules in games with other children."},
		{"5y-social-perform", social, "Sings, dances, or puts on a little performance for you."},
		{"5y-social-chores", social, "Helps with simple household chores."},
		{"5y-language-story", language, "Tells a heard or invented story with two or more events."},
		{"5y-language-book", language, "Answers simple questions after hearing a story."},
		{"5y-language-conversation", language, "Keeps a conversation going for more than three exchanges."},
		{"5y-language-rhyme", language, "Recognizes or uses easy rhymes."},
		{"5y-thinking-count", thinking, "Can count up to ten."},
		{"5y-thinking-digits", thinking, "Names some digits from one to five when shown."},
		{"5y-thinking-time", thinking, "Uses words for times and days, such as tomorrow."},
		{"5y-thinking-focus", thinking, "Attends to an activity other than screens for five to ten minutes."},
		{"5y-thinking-write", thinking, "Writes some letters from their own name."},
		{"5y-thinking-letters", thinking, "Can name some letters when shown."},
		{"5y-movement-buttons", movement, "Fastens some buttons."},
		{"5y-movement-hop", movement, "Hops on one foot."},
	},
}
