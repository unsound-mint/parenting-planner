package virtualbaby

import (
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/content"
)

// Scenario wording is Dayana's (AGENTS.md): plain, kind, never diagnostic.
// Every choice's feedback cites one of the pages below, opened on the checked
// date. The simulation is practice, not a prediction of a real baby.

var checked = time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)

var (
	srcSafeSleep = content.Source{Title: "NICHD Safe to Sleep: Ways to Reduce Baby's Risk", URL: "https://safetosleep.nichd.nih.gov/reduce-risk/reduce", CheckedAt: checked}
	srcCues      = content.Source{Title: "CDC: Signs Your Child Is Hungry or Full", URL: "https://www.cdc.gov/infant-toddler-nutrition/mealtime/signs-your-child-is-hungry-or-full.html", CheckedAt: checked}
	srcCrying    = content.Source{Title: "CDC: About Abusive Head Trauma", URL: "https://www.cdc.gov/child-abuse-neglect/about/about-abusive-head-trauma.html", CheckedAt: checked}
	srcSoothe    = content.Source{Title: "NHS: Soothing a crying baby", URL: "https://www.nhs.uk/baby/caring-for-a-newborn/soothing-a-crying-baby/", CheckedAt: checked}
	srcNappy     = content.Source{Title: "NHS: How to change your baby's nappy", URL: "https://www.nhs.uk/baby/caring-for-a-newborn/how-to-change-your-babys-nappy/", CheckedAt: checked}
)

type Need string

const (
	Hungry Need = "hungry"
	Wet    Need = "wet"
	Sleepy Need = "sleepy"
	Fussy  Need = "fussy"
)

// Needs in display order.
var Needs = []Need{Hungry, Wet, Sleepy, Fussy}

// Every is how many simulated minutes a need takes to build up again after it
// was cared for. A simplification for the meters, not a schedule for a real baby.
var Every = map[Need]int{Hungry: 180, Wet: 150, Sleepy: 120, Fussy: 240}

type Action string

const (
	Feed     Action = "offer_feed"
	Change   Action = "change_diaper"
	Settle   Action = "lay_down"
	Soothe   Action = "comfort"
	Wait     Action = "wait"
	StepAway Action = "step_away"
	Move     Action = "carry"
)

type Fit string

const (
	Recommended Fit = "recommended"
	AnotherWay  Fit = "another_way"
)

type Feedback struct {
	Fit      Fit
	Headline string
	Why      string
	Source   content.Source
}

type Choice struct {
	ID       string
	Label    string
	Action   Action
	Feedback Feedback
}

type Scenario struct {
	ID      string
	Need    Need
	Title   string
	Cue     string
	Choices []Choice
}

// Choice returns the scenario's choice with this id.
func (s Scenario) Choice(id string) (Choice, bool) {
	for _, c := range s.Choices {
		if c.ID == id {
			return c, true
		}
	}
	return Choice{}, false
}

func rec(headline, why string, src content.Source) Feedback {
	return Feedback{Fit: Recommended, Headline: headline, Why: why, Source: src}
}

func other(headline, why string, src content.Source) Feedback {
	return Feedback{Fit: AnotherWay, Headline: headline, Why: why, Source: src}
}

var scenarios = []Scenario{
	{
		ID: "early-cues", Need: Hungry, Title: "Hands to mouth",
		Cue: "She is sucking on her fist, smacking her lips and turning toward you. No crying yet.",
		Choices: []Choice{
			{ID: "feed", Label: "Feed her now", Action: Feed, Feedback: rec(
				"You caught the early cues.",
				"Hands to mouth, lip smacking and turning toward the breast or bottle are early hunger signs. Feeding now, while she is calm, is easier for both of you.", srcCues)},
			{ID: "wait-cry", Label: "Wait until she cries, to be sure", Action: Wait, Feedback: other(
				"Crying usually comes later.",
				"Crying is often a late sign of hunger. A calm baby feeds more easily, so the early cues are the moment to start.", srcCues)},
			{ID: "pacifier", Label: "Offer a pacifier to stretch the time", Action: Soothe, Feedback: other(
				"She is telling you she is hungry.",
				"Hands to mouth and turning toward you are hunger signs for babies up to five months. Following them now saves a harder feed later.", srcCues)},
		},
	},
	{
		ID: "turns-away", Need: Hungry, Title: "Turning away",
		Cue: "Halfway through the bottle she closes her mouth, turns her head away and her hands relax.",
		Choices: []Choice{
			{ID: "pause", Label: "Pause, burp her and let her decide", Action: Feed, Feedback: rec(
				"You read her fullness signs.",
				"Closing her mouth, turning away and relaxed hands are signs a young baby is full. Letting her lead keeps feeding calm.", srcCues)},
			{ID: "finish", Label: "Finish the bottle so she sleeps longer", Action: Feed, Feedback: other(
				"She may already be full.",
				"Turning away and relaxed hands are fullness signs. Stopping when she shows them lets her set the amount.", srcCues)},
		},
	},
	{
		ID: "night-feed", Need: Hungry, Title: "Night feed",
		Cue: "It is the middle of the night. She is rooting and fussing, and you are very tired.",
		Choices: []Choice{
			{ID: "feed-crib", Label: "Feed her, then back in her own crib on her back", Action: Feed, Feedback: rec(
				"Fed, and back in her own safe space.",
				"Room sharing, with her sleep space near but not in your bed, is safer than sharing your bed. Back to sleep for naps and at night.", srcSafeSleep)},
			{ID: "bed", Label: "Feed lying down in your bed and drift off together", Action: Feed, Feedback: other(
				"Her own sleep space is safer.",
				"A sleep space near your bed, but not in it, is safer than sharing your bed with her. Back to sleep in her own crib.", srcSafeSleep)},
		},
	},
	{
		ID: "wipes-away", Need: Wet, Title: "Wipes across the room",
		Cue: "She is on the changing table with a wet diaper, and the wipes are on the shelf across the room.",
		Choices: []Choice{
			{ID: "take-her", Label: "Pick her up and bring her with you", Action: Change, Feedback: rec(
				"She never left your hands.",
				"Never walk away or turn your back while she is on a changing table. Next time, gather everything in one place before you start, or change her on a mat on the floor.", srcNappy)},
			{ID: "step-away", Label: "Step away quickly, she cannot roll yet", Action: Change, Feedback: other(
				"Take her with you, even for a second.",
				"On a changing table, keep an eye on her at all times and never walk away or turn your back. A mat on the floor is the calmer option.", srcNappy)},
		},
	},
	{
		ID: "after-feed", Need: Wet, Title: "Wet after a feed",
		Cue: "She just finished feeding and is drowsy. Her diaper is wet.",
		Choices: []Choice{
			{ID: "change", Label: "Change her now", Action: Change, Feedback: rec(
				"A fresh diaper, then sleep.",
				"Changing a diaper soon after a wee or poo helps prevent diaper rash. Young babies may need 10 or 12 changes a day.", srcNappy)},
			{ID: "later", Label: "Leave it until the next feed", Action: Wait, Feedback: other(
				"Sooner is kinder to her skin.",
				"Changing as soon as possible after a wee or poo helps prevent diaper rash.", srcNappy)},
		},
	},
	{
		ID: "poo-change", Need: Wet, Title: "A big one",
		Cue: "A poo diaper, and she is kicking. You have the mat, wipes and a clean diaper ready.",
		Choices: []Choice{
			{ID: "front-back", Label: "Wipe from front to back", Action: Change, Feedback: rec(
				"Front to back, every time.",
				"Girls should be cleaned from front to back to keep germs away. Having everything ready first, as you did, keeps the change quick.", srcNappy)},
			{ID: "back-front", Label: "Wipe whichever way is quickest", Action: Change, Feedback: other(
				"Direction matters here.",
				"Cleaning a girl from front to back keeps germs away from her vagina.", srcNappy)},
		},
	},
	{
		ID: "on-her-back", Need: Sleepy, Title: "Heavy eyes",
		Cue: "She is yawning and her eyes are closing. Her crib is ready.",
		Choices: []Choice{
			{ID: "back", Label: "On her back, in the crib", Action: Settle, Feedback: rec(
				"Back to sleep, every sleep.",
				"Place babies on their backs to sleep, for naps and at night, on a firm, flat surface.", srcSafeSleep)},
			{ID: "tummy", Label: "On her tummy, she seems to like it", Action: Settle, Feedback: other(
				"On her back is the safe way.",
				"Place babies on their backs to sleep for naps and at night. It is one of the main ways to reduce the risk.", srcSafeSleep)},
			{ID: "side", Label: "On her side, propped with a rolled blanket", Action: Settle, Feedback: other(
				"Back, and nothing else in the crib.",
				"Back sleeping on a flat surface, with only a fitted sheet. Blankets and props belong outside the sleep area.", srcSafeSleep)},
		},
	},
	{
		ID: "cosy-crib", Need: Sleepy, Title: "A cosy gift",
		Cue: "A friend gave you a padded bumper, a quilt and a soft bunny for the crib. Nap time.",
		Choices: []Choice{
			{ID: "bare", Label: "Fitted sheet only, gifts on the shelf", Action: Settle, Feedback: rec(
				"Empty crib, safe crib.",
				"Remove everything from her sleep area except a fitted sheet. Bumpers and soft bedding are linked to serious injuries and deaths.", srcSafeSleep)},
			{ID: "cosy", Label: "Add them so she feels snug", Action: Settle, Feedback: other(
				"Keep the crib bare.",
				"Keep soft objects, toys, bumpers and loose bedding out of her sleep area. Only a fitted sheet on a firm mattress.", srcSafeSleep)},
		},
	},
	{
		ID: "sofa-doze", Need: Sleepy, Title: "Dozing on the sofa",
		Cue: "She fell asleep on your chest on the sofa, and you are nodding off too.",
		Choices: []Choice{
			{ID: "crib", Label: "Move her to her crib, on her back", Action: Move, Feedback: rec(
				"The right call, even half asleep.",
				"Couches and armchairs are never safe places for babies to sleep. Her crib, on her back, is.", srcSafeSleep)},
			{ID: "stay", Label: "Stay put, you will stay awake", Action: Wait, Feedback: other(
				"Move her before you drift off.",
				"Couches and armchairs are never safe places for babies to sleep, especially with a tired adult. Her crib is the safe place.", srcSafeSleep)},
		},
	},
	{
		ID: "car-seat", Need: Sleepy, Title: "Asleep in the car seat",
		Cue: "You are home from a drive and she is fast asleep in her car seat.",
		Choices: []Choice{
			{ID: "move", Label: "Move her to her crib", Action: Move, Feedback: rec(
				"Flat and firm for sleep.",
				"Car seats and strollers are not for routine sleep. If she falls asleep in one, move her to her regular sleep space as soon as you can.", srcSafeSleep)},
			{ID: "leave", Label: "Let her nap in the seat, she is settled", Action: Wait, Feedback: other(
				"Worth the small wake-up.",
				"Sitting devices are not for routine sleep. Move her to her regular sleep space as soon as possible.", srcSafeSleep)},
		},
	},
	{
		ID: "too-warm", Need: Sleepy, Title: "Chilly evening",
		Cue: "The evening feels cold. You wonder about a hat and an extra blanket for the night.",
		Choices: []Choice{
			{ID: "light", Label: "Light layers, head uncovered", Action: Settle, Feedback: rec(
				"Warm, not hot.",
				"Avoid letting her get too hot, and keep her head and face uncovered during sleep.", srcSafeSleep)},
			{ID: "bundle", Label: "Hat and an extra blanket", Action: Settle, Feedback: other(
				"Too warm is the bigger worry.",
				"Keep her head and face uncovered and avoid overheating. No loose blankets in the crib.", srcSafeSleep)},
		},
	},
	{
		ID: "checked-all", Need: Fussy, Title: "Still crying",
		Cue: "She is fed, changed and not too warm, and she is still crying.",
		Choices: []Choice{
			{ID: "hold", Label: "Hold her close, sway and hum", Action: Soothe, Feedback: rec(
				"Close and gentle.",
				"Holding her, swaying, talking or singing, a gentle walk or soft background noise can all help.", srcSoothe)},
			{ID: "bath", Label: "Try a warm bath", Action: Soothe, Feedback: rec(
				"Worth a try.",
				"A warm bath calms some babies, though it upsets others. If it does not help, closeness and gentle movement are next.", srcSoothe)},
			{ID: "switch", Label: "Keep switching tricks every minute", Action: Soothe, Feedback: other(
				"Slower can work better.",
				"Babies can be overstimulated. Pick one calm thing, like holding her and swaying, and give it time.", srcSoothe)},
		},
	},
	{
		ID: "at-limit", Need: Fussy, Title: "An hour of crying",
		Cue: "She has cried for an hour. Nothing works and you feel your patience running out.",
		Choices: []Choice{
			{ID: "step-away", Label: "Put her in her crib and step away to calm down", Action: StepAway, Feedback: rec(
				"Looking after yourself is looking after her.",
				"Long crying is normal for babies. Put her in a safe place, walk away to calm down, and check on her every 5 to 10 minutes.", srcCrying)},
			{ID: "hand-over", Label: "Hand her to your partner and take a break", Action: StepAway, Feedback: rec(
				"That is what a team is for.",
				"When crying gets too much, calling in someone you trust, a partner, friend or relative, is the right move.", srcCrying)},
			{ID: "push-on", Label: "Keep going, you should be able to fix this", Action: Soothe, Feedback: other(
				"It is not yours to fix.",
				"Crying, even long inconsolable crying, is normal in the first months and gets better. If you feel frustrated, put her somewhere safe and step away for a few minutes.", srcCrying)},
		},
	},
}

var byID = func() map[string]Scenario {
	m := make(map[string]Scenario, len(scenarios))
	for _, s := range scenarios {
		m[s.ID] = s
	}
	return m
}()

// Lookup returns a scenario by id.
func Lookup(id string) (Scenario, bool) {
	s, ok := byID[id]
	return s, ok
}

// Scenarios is the whole catalogue, for tests.
func Scenarios() []Scenario { return scenarios }
