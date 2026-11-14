import type { GuideAudience, SimulatorChoice, Source, Stage } from "@/lib/api/types";

// Snapshot of the learning content for preview mocks: api/internal/content
// (learn_paths.json, talk_prompts.json) is the source of truth once the backend
// serves it. Quiz ids are lessonId-qN and choice ids a, b, c, like the API.

export type CatalogQuestion = { id: string; prompt: string; choices: SimulatorChoice[]; correct: string; why: string };
export type CatalogLesson = {
  id: string; title: string; body: string[]; minutes: number; weeks: [number, number]; audience: GuideAudience[];
  source: Source; extraSources: Source[]; talkPrompt?: string; urgentHelpLink: boolean; quiz: CatalogQuestion[];
};
export type CatalogPath = { id: string; title: string; why: string; stages: Stage[]; lessons: CatalogLesson[] };

export const learnPaths: CatalogPath[] = [
  {
    "id": "your-pregnancy",
    "title": "Your pregnancy",
    "why": "Knowing the rhythm of the next months makes each visit, test and twinge less of a surprise, for both of you.",
    "stages": [
      "pregnancy"
    ],
    "lessons": [
      {
        "id": "visit-rhythm",
        "title": "The rhythm of prenatal visits",
        "body": [
          "Your first prenatal visit is usually one of the longest, so leave plenty of time and bring questions. The team will work out a due date from the first day of the last period and, depending on the week, an ultrasound. After that, visits follow a steady beat. Before 28 weeks they are about monthly. From 28 to 36 weeks they come every two weeks, and from 36 weeks until the birth, every week. At most visits someone checks how things are going, and once the bump shows they measure it to follow the baby's growth. Some visits add blood tests or an ultrasound. Knowing this pattern helps the two of you plan. A partner who wants to come along can book time off early, and the calendar stops being a pile of surprises. Treat each visit as a short check-in for the whole family: what is new, what is worrying you, and what you want to ask next time."
        ],
        "minutes": 1,
        "weeks": [
          4,
          12
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NICHD: What Happens During Prenatal Visits",
          "url": "https://www.nichd.nih.gov/health/topics/preconceptioncare/conditioninfo/prenatal-visits",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Which visits does each of us want to go to together? Put two of them in the calendar tonight.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "visit-rhythm-q1",
            "prompt": "How often are prenatal visits before 28 weeks, in the usual schedule?",
            "choices": [
              {
                "id": "a",
                "text": "Every week"
              },
              {
                "id": "b",
                "text": "About once a month"
              },
              {
                "id": "c",
                "text": "Every two weeks"
              }
            ],
            "correct": "b",
            "why": "NICHD lists monthly visits before 28 weeks."
          },
          {
            "id": "visit-rhythm-q2",
            "prompt": "From week 36 to the birth, visits are usually...",
            "choices": [
              {
                "id": "a",
                "text": "Weekly"
              },
              {
                "id": "b",
                "text": "Monthly"
              },
              {
                "id": "c",
                "text": "Only if something changes"
              }
            ],
            "correct": "a",
            "why": "The schedule tightens to every week in the last stretch."
          },
          {
            "id": "visit-rhythm-q3",
            "prompt": "What is fundal height?",
            "choices": [
              {
                "id": "a",
                "text": "A blood test"
              },
              {
                "id": "b",
                "text": "A measurement of the bump to follow growth"
              },
              {
                "id": "c",
                "text": "The baby's length on ultrasound"
              }
            ],
            "correct": "b",
            "why": "Once you begin to show, the abdomen is measured to check growth."
          }
        ]
      },
      {
        "id": "everyday-habits",
        "title": "Food, coffee and everyday habits",
        "body": [
          "A lot of pregnancy advice is about small daily choices, and it is easier when both of you share them. Fish is still on the menu: the FDA guidance quoted by NICHD allows up to 12 ounces a week of low-mercury fish such as salmon, canned light tuna and shrimp, with albacore tuna kept to 6 ounces. Raw fish, undercooked meat, deli meat and unpasteurized cheese are best skipped, so check the label on soft cheeses. Caffeine is something to limit rather than cut entirely; ask your provider what amount suits you. Alcohol, tobacco and drugs are the clear no. NICHD links all three to problems for the baby. If quitting is hard, your provider can help, and that goes for the partner too, since second-hand smoke counts. Shared habits are kinder: if one of you stops drinking for nine months, the other joining in makes it feel like a team project."
        ],
        "minutes": 1,
        "weeks": [
          5,
          16
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NICHD: Healthy Pregnancy",
          "url": "https://www.nichd.nih.gov/health/topics/preconceptioncare/conditioninfo/healthy-pregnancy",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Which habit could we change together for the next months, so nobody does it alone?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "everyday-habits-q1",
            "prompt": "How much low-mercury fish a week does the FDA guidance quoted by NICHD allow?",
            "choices": [
              {
                "id": "a",
                "text": "None"
              },
              {
                "id": "b",
                "text": "Up to 12 ounces"
              },
              {
                "id": "c",
                "text": "Up to 3 pounds"
              }
            ],
            "correct": "b",
            "why": "Low-mercury fish like salmon and shrimp is fine up to 12 ounces a week."
          },
          {
            "id": "everyday-habits-q2",
            "prompt": "Which of these is best avoided in pregnancy?",
            "choices": [
              {
                "id": "a",
                "text": "Pasteurized cheese"
              },
              {
                "id": "b",
                "text": "Deli meat"
              },
              {
                "id": "c",
                "text": "Cooked salmon"
              }
            ],
            "correct": "b",
            "why": "NICHD lists deli meat with raw fish, undercooked meat and unpasteurized cheese."
          },
          {
            "id": "everyday-habits-q3",
            "prompt": "Does second-hand smoke matter in pregnancy?",
            "choices": [
              {
                "id": "a",
                "text": "No, only the pregnant person's smoking counts"
              },
              {
                "id": "b",
                "text": "Yes, exposure can harm the fetus"
              }
            ],
            "correct": "b",
            "why": "NICHD names second-hand smoke among the exposures that can harm the fetus."
          }
        ]
      },
      {
        "id": "first-movements",
        "title": "Getting to know the baby's movements",
        "body": [
          "Somewhere around the middle of pregnancy, many people feel the first movements. At first it is more like bubbling or fluttering than a kick, and it is easy to miss. NHS describes babies at this stage as busy: kicking, punching, turning and even sucking a thumb, which practices the reflex they will use to feed. Over the following weeks the movements get stronger, and later a partner may see the bump move or feel a kick with a hand in the right spot. What matters most is getting to know your own baby's pattern: when they tend to be busy, when they are quiet. That pattern becomes your reference. If movements ever slow down or stop, do not wait to see what happens; contact your care team right away. For now, enjoy it. Evenings on the sofa with a hand on the bump are one of the nicest parts of these months."
        ],
        "minutes": 1,
        "weeks": [
          16,
          28
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NHS Start for Life: Week 20",
          "url": "https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/2nd-trimester/week-20/",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [
          {
            "title": "CDC Hear Her: Maternal Warning Signs",
            "url": "https://www.cdc.gov/hearher/maternal-warning-signs/index.html",
            "checkedAt": "2026-11-14"
          },
          {
            "title": "NHS Start for Life: Week 23",
            "url": "https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/2nd-trimester/week-23/",
            "checkedAt": "2026-11-14"
          }
        ],
        "talkPrompt": "When does the baby seem most active? Try a quiet ten minutes tonight with a hand on the bump.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "first-movements-q1",
            "prompt": "What do early movements often feel like?",
            "choices": [
              {
                "id": "a",
                "text": "Sharp kicks"
              },
              {
                "id": "b",
                "text": "Bubbling or fluttering"
              },
              {
                "id": "c",
                "text": "Nothing at all until week 30"
              }
            ],
            "correct": "b",
            "why": "NHS describes the first movements as a bubbling or fluttering."
          },
          {
            "id": "first-movements-q2",
            "prompt": "What should you do if movements slow down or stop?",
            "choices": [
              {
                "id": "a",
                "text": "Wait a few days"
              },
              {
                "id": "b",
                "text": "Contact your care team right away"
              },
              {
                "id": "c",
                "text": "Count kicks for a week first"
              }
            ],
            "correct": "b",
            "why": "A change in movements is a reason to call, not to wait."
          }
        ]
      },
      {
        "id": "warning-signs",
        "title": "Warning signs both of you should know",
        "body": [
          "Most pregnancies go smoothly, and this lesson is not meant to worry you. It is here so that if something serious happens, neither of you has to look it up in a hurry. CDC's Hear Her campaign lists signs that need medical care right away, during pregnancy and in the year after. They include a headache that will not go away or gets worse, dizziness or fainting, changes in vision, a fever of 100.4 F or higher, extreme swelling of the hands or face, trouble breathing, chest pain or a racing heart, severe belly pain that does not go away, the baby's movements slowing or stopping, vaginal bleeding or leaking fluid, severe swelling, redness or pain in a leg or arm, overwhelming tiredness, and thoughts of harming yourself or the baby. CDC also says: if something just does not feel right, talk to your provider. The partner matters here, because the person who is unwell may play it down. You both have permission to call."
        ],
        "minutes": 1,
        "weeks": [
          18,
          32
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "CDC Hear Her: Maternal Warning Signs",
          "url": "https://www.cdc.gov/hearher/maternal-warning-signs/index.html",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Save your provider's after-hours number in both phones tonight, and agree that either of you can make the call.",
        "urgentHelpLink": true,
        "quiz": [
          {
            "id": "warning-signs-q1",
            "prompt": "At what temperature does CDC list fever as a warning sign?",
            "choices": [
              {
                "id": "a",
                "text": "99.0 F"
              },
              {
                "id": "b",
                "text": "100.4 F or higher"
              },
              {
                "id": "c",
                "text": "103 F or higher"
              }
            ],
            "correct": "b",
            "why": "Hear Her lists a fever of 100.4 F or higher."
          },
          {
            "id": "warning-signs-q2",
            "prompt": "Do the warning signs only apply during pregnancy?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No, they also apply in the year after birth"
              }
            ],
            "correct": "b",
            "why": "Hear Her covers pregnancy and the year after."
          },
          {
            "id": "warning-signs-q3",
            "prompt": "What does CDC suggest if something just does not feel right?",
            "choices": [
              {
                "id": "a",
                "text": "Wait until the next visit"
              },
              {
                "id": "b",
                "text": "Talk to your provider"
              },
              {
                "id": "c",
                "text": "Search online first"
              }
            ],
            "correct": "b",
            "why": "You do not need to be sure it is serious to call."
          }
        ]
      }
    ]
  },
  {
    "id": "birth",
    "title": "Birth",
    "why": "Labor is easier to face when you have talked it through before it starts, including the parts that might not go to plan.",
    "stages": [
      "pregnancy"
    ],
    "lessons": [
      {
        "id": "how-labor-starts",
        "title": "How labor starts",
        "body": [
          "A due date is a best guess. NICHD says that for most women labor begins somewhere between week 37 and week 42, and that unless an earlier birth is medically needed, waiting until at least 39 weeks gives mother and baby the best chance. The main sign of labor is contractions that come regularly and, over time, get stronger, last longer and come more often. False labor feels different: the contractions are weak or irregular, or they stop when you change position. Other signs can include the baby dropping lower, which can make breathing easier, a clear, pink or slightly bloody discharge called the show, a low, dull backache, cramps like period cramps, and a gush or trickle of fluid when the waters break. NICHD's guide is to let your provider know when contractions come regularly every 5 to 10 minutes for an hour. Regular, frequent contractions before 37 weeks can be a sign of preterm labor, so call your provider or go to the hospital. Ask your team early what their own rule is for when to come in, since some prefer that you wait for active labor."
        ],
        "minutes": 1,
        "weeks": [
          30,
          38
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NICHD: Start of Labor",
          "url": "https://www.nichd.nih.gov/health/topics/labor-delivery/topicinfo/start-of-labor",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Who will drive, who calls the hospital, and what happens with work or pets if labor starts at 3 a.m.?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "how-labor-starts-q1",
            "prompt": "When does labor usually start?",
            "choices": [
              {
                "id": "a",
                "text": "Exactly on the due date"
              },
              {
                "id": "b",
                "text": "Somewhere between week 37 and week 42"
              },
              {
                "id": "c",
                "text": "Only after week 40"
              }
            ],
            "correct": "b",
            "why": "NICHD says most labors begin between week 37 and week 42 of pregnancy."
          },
          {
            "id": "how-labor-starts-q2",
            "prompt": "Contractions have come regularly every 5 to 10 minutes for an hour. What now?",
            "choices": [
              {
                "id": "a",
                "text": "Wait for the waters to break first"
              },
              {
                "id": "b",
                "text": "Let your provider know"
              }
            ],
            "correct": "b",
            "why": "NICHD advises telling your provider when regular contractions come every 5 to 10 minutes for an hour."
          },
          {
            "id": "how-labor-starts-q3",
            "prompt": "Regular, frequent contractions start at week 33. What do you do?",
            "choices": [
              {
                "id": "a",
                "text": "Wait and see if they settle by morning"
              },
              {
                "id": "b",
                "text": "Call your provider or go to the hospital"
              }
            ],
            "correct": "b",
            "why": "Before 37 weeks this can be preterm labor, and NICHD says to notify a provider or go to the hospital."
          }
        ]
      },
      {
        "id": "pain-relief",
        "title": "Pain relief: the options",
        "body": [
          "How much labor hurts differs a lot from person to person and from birth to birth, and there is no prize for going without help. NICHD describes two broad routes, which many people combine. Medicines include analgesics, which dull pain without taking away all feeling, and anesthetics, which block feeling. In the US the most common choice is regional pain relief, mainly the epidural: a thin tube placed in the lower back so medicine can keep flowing while you stay awake. It usually starts working within 10 to 20 minutes. A spinal block works right away but lasts only an hour or two. Non-medicine methods include continuous support from someone you trust, breathing and relaxation, music, a TENS unit, and sterile water injections for back pain. The best time to learn the options is now, not mid-contraction. Ask your provider what is available where you plan to give birth, and write your preferences down so everyone in the room knows them."
        ],
        "minutes": 1,
        "weeks": [
          28,
          36
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NICHD: Pain relief during labor and delivery",
          "url": "https://www.nichd.nih.gov/health/topics/labor-delivery/topicinfo/pain-relief",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "What would each of us like to try first for pain, and how will the partner know when to speak up for it?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "pain-relief-q1",
            "prompt": "What is the most common way to relieve labor pain in the US?",
            "choices": [
              {
                "id": "a",
                "text": "General anesthesia"
              },
              {
                "id": "b",
                "text": "Regional pain relief such as an epidural"
              },
              {
                "id": "c",
                "text": "No pain relief"
              }
            ],
            "correct": "b",
            "why": "NICHD names regional analgesia as the most common in the US."
          },
          {
            "id": "pain-relief-q2",
            "prompt": "How soon does an epidural usually start working?",
            "choices": [
              {
                "id": "a",
                "text": "Right away"
              },
              {
                "id": "b",
                "text": "About 10 to 20 minutes"
              },
              {
                "id": "c",
                "text": "About 2 hours"
              }
            ],
            "correct": "b",
            "why": "NICHD gives 10 to 20 minutes."
          },
          {
            "id": "pain-relief-q3",
            "prompt": "Which of these is a non-medicine method NICHD lists?",
            "choices": [
              {
                "id": "a",
                "text": "Continuous support from someone you trust"
              },
              {
                "id": "b",
                "text": "A spinal block"
              },
              {
                "id": "c",
                "text": "Local anesthesia"
              }
            ],
            "correct": "a",
            "why": "Continuous labor support is on the natural methods list."
          }
        ]
      },
      {
        "id": "cesarean",
        "title": "If the birth becomes a cesarean",
        "body": [
          "In 2015 about a third of US births were cesareans, according to CDC data quoted by NICHD, so it is worth knowing how one goes even if you plan a vaginal birth. A cesarean is surgery: the baby is born through a cut in the belly and uterus, which is then closed with stitches that dissolve. NICHD lists common reasons: labor that is not progressing, a baby who needs to be born quickly, a baby lying feet first or sideways, twins or more, problems with the placenta, some infections, or the parent's own health. Pain relief is usually an epidural or spinal block, which numbs the lower body; general anesthesia, where you are asleep, is often used for emergency cesareans. Ask your hospital now about who can be with you. The hospital stay is often longer than after a vaginal birth. Talking it through now means that if plans change on the day, it feels like a path you already know about rather than a failure. Either way of giving birth brings your baby home."
        ],
        "minutes": 1,
        "weeks": [
          30,
          38
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NICHD: Cesarean delivery",
          "url": "https://www.nichd.nih.gov/health/topics/labor-delivery/topicinfo/c-section",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "If the birth changes plan, what matters most to each of us in that moment? Who holds the baby first?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "cesarean-q1",
            "prompt": "Which kinds of pain relief does NICHD list for a cesarean?",
            "choices": [
              {
                "id": "a",
                "text": "Epidural, spinal block or general anesthesia"
              },
              {
                "id": "b",
                "text": "Only general anesthesia"
              },
              {
                "id": "c",
                "text": "No pain relief"
              }
            ],
            "correct": "a",
            "why": "NICHD names all three; general anesthesia is often used in emergencies."
          },
          {
            "id": "cesarean-q2",
            "prompt": "Which is a common reason for a cesarean?",
            "choices": [
              {
                "id": "a",
                "text": "The baby is lying feet first"
              },
              {
                "id": "b",
                "text": "The pregnancy is past 37 weeks"
              },
              {
                "id": "c",
                "text": "The parent asked for an epidural"
              }
            ],
            "correct": "a",
            "why": "A breech position is one of the reasons NICHD lists."
          }
        ]
      },
      {
        "id": "first-checks",
        "title": "The newborn's first checks",
        "body": [
          "Before you leave the hospital, your baby will have a few screening tests. They are routine and done for every baby. A few drops of blood are taken by pricking the baby's heel, to look for inherited disorders. Every state tests for at least 30 of these, and the exact list depends on where you live. There is a hearing test that measures how the baby responds to sound. And there is a quick skin sensor that checks the oxygen level in the blood, which can pick up some heart conditions. Ask your team which tests your state includes and how you will get the results, so nobody is left wondering. A partner can take this job on while the birth parent rests."
        ],
        "minutes": 1,
        "weeks": [
          34,
          40
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "MedlinePlus: Newborn Screening",
          "url": "https://medlineplus.gov/newbornscreening.html",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Who will ask about the screening results, and where will we keep the baby's papers?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "first-checks-q1",
            "prompt": "How many conditions do all states screen for, at minimum, in the heel prick test?",
            "choices": [
              {
                "id": "a",
                "text": "5"
              },
              {
                "id": "b",
                "text": "At least 30"
              },
              {
                "id": "c",
                "text": "Over 300"
              }
            ],
            "correct": "b",
            "why": "MedlinePlus says all states test for at least 30."
          },
          {
            "id": "first-checks-q2",
            "prompt": "What does the skin oxygen check look for?",
            "choices": [
              {
                "id": "a",
                "text": "Jaundice"
              },
              {
                "id": "b",
                "text": "Some heart conditions"
              },
              {
                "id": "c",
                "text": "Hearing loss"
              }
            ],
            "correct": "b",
            "why": "Low blood oxygen can point to a congenital heart defect."
          }
        ]
      }
    ]
  },
  {
    "id": "feeding",
    "title": "Feeding",
    "why": "Breast milk, formula or both: knowing the basics before the baby arrives takes a lot of guesswork out of the first weeks.",
    "stages": [
      "pregnancy",
      "postpartum",
      "infant"
    ],
    "lessons": [
      {
        "id": "reading-cues",
        "title": "Reading hunger and fullness cues",
        "body": [
          "Newborns cannot tell you they are hungry, but they do tell you. CDC lists the early hunger signs for babies up to five months: hands going to the mouth, turning the head toward the breast or bottle, puckering, smacking or licking the lips, and clenched little fists. Spotting these early signs lets you start feeding before the baby gets upset. Fullness has its own signals: the mouth closes, the head turns away, and the hands relax. Following these cues works the same way for breast milk and formula. It also means you do not have to push a baby to finish a bottle. This is a skill both parents can learn equally well, and it is a lovely thing to practice together in the first days: watching the baby and naming what you see."
        ],
        "minutes": 1,
        "weeks": [
          26,
          36
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "CDC: Signs Your Child is Hungry or Full",
          "url": "https://www.cdc.gov/infant-toddler-nutrition/mealtime/signs-your-child-is-hungry-or-full.html",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "How do we each imagine feeding at night? Is there a feed the partner could own?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "reading-cues-q1",
            "prompt": "Which is an early hunger cue?",
            "choices": [
              {
                "id": "a",
                "text": "Relaxed hands"
              },
              {
                "id": "b",
                "text": "Hands to the mouth"
              },
              {
                "id": "c",
                "text": "Turning away from the bottle"
              }
            ],
            "correct": "b",
            "why": "CDC lists hands to the mouth as a hunger sign."
          },
          {
            "id": "reading-cues-q2",
            "prompt": "Relaxed hands and turning away usually mean...",
            "choices": [
              {
                "id": "a",
                "text": "Still hungry"
              },
              {
                "id": "b",
                "text": "Full"
              },
              {
                "id": "c",
                "text": "Tired of the position"
              }
            ],
            "correct": "b",
            "why": "Both are on CDC's fullness list."
          }
        ]
      },
      {
        "id": "breastfeeding-rhythm",
        "title": "The breastfeeding rhythm",
        "body": [
          "If you plan to breastfeed, expect it to be frequent at first. CDC says most exclusively breastfed babies feed every two to four hours, around 8 to 12 times in 24 hours. That rhythm is normal, not a sign that something is wrong. Feeds will not all be the same length. A baby who has had enough usually seems content and drowsy afterward. If you are unsure whether the baby is getting enough, or how they are growing, ask the baby's doctor or nurse; that is exactly the kind of question they want to hear. For the partner, those 8 to 12 feeds are the shape of the day and night, and there is a lot to do around them: bringing water and snacks, burping and changing, and taking the baby afterward so the feeding parent can sleep. Breastfeeding is a skill for two people to learn, and it often takes some days to click."
        ],
        "minutes": 1,
        "weeks": [
          28,
          38
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "CDC: How Much and How Often to Breastfeed",
          "url": "https://www.cdc.gov/infant-toddler-nutrition/breastfeeding/how-much-and-how-often.html",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "What could the partner take on around each feed so the feeding parent gets real rest?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "breastfeeding-rhythm-q1",
            "prompt": "How many times in 24 hours does a newborn breastfeed, according to CDC?",
            "choices": [
              {
                "id": "a",
                "text": "3 to 4"
              },
              {
                "id": "b",
                "text": "8 to 12"
              },
              {
                "id": "c",
                "text": "20 or more"
              }
            ],
            "correct": "b",
            "why": "CDC gives 8 to 12 times in 24 hours."
          },
          {
            "id": "breastfeeding-rhythm-q2",
            "prompt": "What is a sign a baby has had enough milk?",
            "choices": [
              {
                "id": "a",
                "text": "Content and drowsy after feeding"
              },
              {
                "id": "b",
                "text": "Crying right after"
              },
              {
                "id": "c",
                "text": "Clenched fists"
              }
            ],
            "correct": "a",
            "why": "CDC describes content and drowsy after a feed."
          }
        ]
      },
      {
        "id": "formula-basics",
        "title": "Formula feeding basics",
        "body": [
          "Some families use formula from the start, some combine it with breast milk, and some switch later. All of these are ways to feed a baby well. CDC suggests offering a newborn 1 to 2 ounces of formula every two to three hours in the first days of life. Like breastfed babies, most formula-fed newborns feed 8 to 12 times in 24 hours. As the baby grows, so does their stomach, and they will drink more at each feed and space feeds to about every three to four hours. Babies generally take what they need and stop when they are full, so watch the baby rather than the bottle markings. Feeds vary in length, and that is normal. If you need to wake a sleepy baby to feed, patting, stroking, undressing or a diaper change can help. The baby's doctor or nurse can tell you how much is right for your baby as they grow."
        ],
        "minutes": 1,
        "weeks": [
          28,
          38
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "CDC: How Much and How Often to Feed Infant Formula",
          "url": "https://www.cdc.gov/infant-toddler-nutrition/formula-feeding/how-much-and-how-often.html",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Are we planning breast milk, formula or both? What would make us feel fine about changing plans?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "formula-basics-q1",
            "prompt": "How much formula does CDC suggest offering in the first days?",
            "choices": [
              {
                "id": "a",
                "text": "1 to 2 ounces every 2 to 3 hours"
              },
              {
                "id": "b",
                "text": "6 ounces every 6 hours"
              },
              {
                "id": "c",
                "text": "As much as the baby can finish"
              }
            ],
            "correct": "a",
            "why": "That is CDC's starting guide for the first days."
          },
          {
            "id": "formula-basics-q2",
            "prompt": "Should a baby always finish the bottle?",
            "choices": [
              {
                "id": "a",
                "text": "Yes, to get enough"
              },
              {
                "id": "b",
                "text": "No, babies usually stop when full"
              }
            ],
            "correct": "b",
            "why": "CDC says babies generally take what they need."
          }
        ]
      },
      {
        "id": "feeding-safe-nights",
        "title": "Night feeds, safely",
        "body": [
          "Night feeds are when exhaustion and a warm baby meet, so it helps to plan them before the baby arrives. Safe to Sleep, the NICHD program based on the AAP task force, suggests keeping the baby's crib or bassinet in your room, close to your bed, for at least the first six months. That makes it easy to feed and comfort without getting all the way up. If you bring the baby into your bed to feed, clear pillows and blankets from your side first, and put the baby back in their own space when you are done. If you fall asleep while feeding in bed, move the baby back as soon as you wake. The one place to avoid completely is the couch or armchair, which is very risky if an adult dozes off. A partner can help a lot here: doing the handoff, settling the baby back down, and noticing when the feeding parent is too tired."
        ],
        "minutes": 1,
        "weeks": [
          32,
          40
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NICHD Safe to Sleep: Ways to Reduce Baby's Risk",
          "url": "https://safetosleep.nichd.nih.gov/reduce-risk/reduce",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Where will the bassinet go, and how will we hand the baby back and forth at night?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "feeding-safe-nights-q1",
            "prompt": "Where does Safe to Sleep say a baby should sleep for at least the first six months?",
            "choices": [
              {
                "id": "a",
                "text": "In the parents' bed"
              },
              {
                "id": "b",
                "text": "In their own crib or bassinet in the parents' room"
              },
              {
                "id": "c",
                "text": "In their own room"
              }
            ],
            "correct": "b",
            "why": "Room sharing without bed sharing is the advice."
          },
          {
            "id": "feeding-safe-nights-q2",
            "prompt": "Where should you never feed if you might fall asleep?",
            "choices": [
              {
                "id": "a",
                "text": "In bed with soft items cleared"
              },
              {
                "id": "b",
                "text": "On a couch or armchair"
              }
            ],
            "correct": "b",
            "why": "Safe to Sleep calls couches and armchairs never safe for baby sleep."
          }
        ]
      }
    ]
  },
  {
    "id": "first-weeks",
    "title": "Sleep and the first weeks",
    "why": "The first weeks are mostly about sleep, crying and small routines. A little preparation keeps everyone safer and calmer.",
    "stages": [
      "pregnancy",
      "postpartum",
      "infant"
    ],
    "lessons": [
      {
        "id": "safe-sleep",
        "title": "Safe sleep, the short version",
        "body": [
          "Safe sleep advice can feel endless, but the core fits on a sticky note. Back to sleep, every sleep, until the first birthday, including naps and including babies born early or with reflux. Once a baby can roll both ways on their own, you can leave them in the position they choose. The sleep surface should be firm, flat and level, with only a fitted sheet. No pillows, blankets, bumpers, soft toys or weighted products in the sleep space. Car seats, strollers, carriers and slings are not for regular sleep; if the baby nods off in one, move them to their crib when you can. Share a room, not a bed, for at least six months. Safe to Sleep is clear that this is for everyone who looks after the baby, so pass it on to grandparents and sitters too. Setting up the crib together before the birth is a good, concrete way to get it right."
        ],
        "minutes": 1,
        "weeks": [
          26,
          36
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NICHD Safe to Sleep: Ways to Reduce Baby's Risk",
          "url": "https://safetosleep.nichd.nih.gov/reduce-risk/reduce",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Who else will put our baby to sleep? How will we share the rules with them?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "safe-sleep-q1",
            "prompt": "What should be in the crib with a newborn?",
            "choices": [
              {
                "id": "a",
                "text": "A pillow and a light blanket"
              },
              {
                "id": "b",
                "text": "Only a fitted sheet"
              },
              {
                "id": "c",
                "text": "Bumpers and one soft toy"
              }
            ],
            "correct": "b",
            "why": "Safe to Sleep says to remove everything but a fitted sheet."
          },
          {
            "id": "safe-sleep-q2",
            "prompt": "Is it fine for a baby to sleep in the car seat at home?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No, move them to their regular sleep space"
              }
            ],
            "correct": "b",
            "why": "Sitting devices are not for regular sleep."
          },
          {
            "id": "safe-sleep-q3",
            "prompt": "Until what age should babies be placed on their backs to sleep?",
            "choices": [
              {
                "id": "a",
                "text": "3 months"
              },
              {
                "id": "b",
                "text": "6 months"
              },
              {
                "id": "c",
                "text": "1 year"
              }
            ],
            "correct": "c",
            "why": "Safe to Sleep says back to sleep until age 1."
          }
        ]
      },
      {
        "id": "crying",
        "title": "When the crying feels endless",
        "body": [
          "All babies cry, and some cry for long stretches that nothing seems to fix. CDC is clear that long periods of crying are normal infant behavior, even though it rarely feels normal at 2 a.m. There are things to try: swaddling, holding the baby skin to skin, a pacifier, gentle rocking, singing or talking softly, or a walk in the stroller. Some nights none of it works, and that is not your failure. What matters most then is you. If you feel your frustration rising, put the baby down on their back in a safe place like the crib, step away, and calm yourself, checking on them every 5 to 10 minutes. Then call someone: your partner, a friend, a relative, or the baby's doctor. Never shake a baby. Agreeing on a tag-out plan now, before the tiredness, makes it easier for either of you to say: I need a break, can you take over?"
        ],
        "minutes": 1,
        "weeks": [
          32,
          40
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "CDC: About Abusive Head Trauma (coping with crying)",
          "url": "https://www.cdc.gov/child-abuse-neglect/about/about-abusive-head-trauma.html",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "What will our tag-out word be when one of us needs a break from the crying?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "crying-q1",
            "prompt": "Is long, inconsolable crying normal in young babies?",
            "choices": [
              {
                "id": "a",
                "text": "Yes, CDC calls it normal infant behavior"
              },
              {
                "id": "b",
                "text": "No, it always means something is wrong"
              }
            ],
            "correct": "a",
            "why": "Crying, even for long periods, is normal for infants."
          },
          {
            "id": "crying-q2",
            "prompt": "What can you do if frustration is building?",
            "choices": [
              {
                "id": "a",
                "text": "Put the baby down safely and step away for a few minutes"
              },
              {
                "id": "b",
                "text": "Keep rocking faster"
              },
              {
                "id": "c",
                "text": "Leave the baby with a sibling"
              }
            ],
            "correct": "a",
            "why": "CDC suggests a safe place, a break and checks every 5 to 10 minutes."
          }
        ]
      },
      {
        "id": "visitors-vaccines",
        "title": "Visitors, hugs and vaccines",
        "body": [
          "Everyone will want to meet the baby, and that is a lovely problem to have. It also helps to plan it. CDC says anyone who spends time around babies should be up to date on routine vaccines, especially whooping cough (Tdap for adults) and the flu shot in flu season. The timing matters: those who need either vaccine should get it at least two weeks before meeting the baby, so their body has time to make antibodies. That includes both parents, grandparents, regular sitters and anyone who will help in the early weeks. Asking can feel awkward, so make it a shared message from both of you, sent well before the due date, rather than a conversation at the door. Visitors can also help in other ways: bringing a meal, doing a load of laundry, holding the baby while you shower. Deciding who comes when, and for how long, is part of protecting your first weeks."
        ],
        "minutes": 1,
        "weeks": [
          28,
          36
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "CDC: Vaccines for Family and Caregivers",
          "url": "https://www.cdc.gov/vaccines-pregnancy/about/vaccines-family-caregivers.html",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Who do we want to see in the first two weeks, and who can wait? Let's write the message to family together.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "visitors-vaccines-q1",
            "prompt": "How long before meeting the baby should visitors get Tdap or a flu shot, if needed?",
            "choices": [
              {
                "id": "a",
                "text": "The same day"
              },
              {
                "id": "b",
                "text": "At least two weeks"
              },
              {
                "id": "c",
                "text": "Six months"
              }
            ],
            "correct": "b",
            "why": "CDC says at least two weeks so antibodies can develop."
          },
          {
            "id": "visitors-vaccines-q2",
            "prompt": "Who should be up to date on vaccines?",
            "choices": [
              {
                "id": "a",
                "text": "Only the parents"
              },
              {
                "id": "b",
                "text": "Anyone who is around the baby"
              }
            ],
            "correct": "b",
            "why": "CDC means everyone around babies, including grandparents and sitters."
          }
        ]
      },
      {
        "id": "baby-blues",
        "title": "Baby blues, or something more",
        "body": [
          "In the first two weeks after birth, many new mothers have what is called the baby blues: mood swings, tearfulness, worry and exhaustion that come and go. Around-the-clock care is hard, and feeling tired or overwhelmed sometimes is normal. NIMH describes the line to watch for. If the low mood, anxiety or unhappiness is severe, or lasts longer than two weeks, it may be postpartum depression, which is common, treatable and nobody's fault. Most episodes start within four to eight weeks after the birth. Signs can include a persistent sad or empty mood, sleeping badly even when the baby sleeps, losing interest in things, and trouble bonding with the baby. Therapy, medicine or both help most people feel better. Partners are often the first to notice, so it is worth agreeing now that either of you can raise it, gently, without it being a judgment. You do not need to be sure before you talk to a provider."
        ],
        "minutes": 1,
        "weeks": [
          30,
          40
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NIMH: Perinatal Depression",
          "url": "https://www.nimh.nih.gov/health/publications/perinatal-depression",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "How would you want me to bring it up if I noticed you were struggling?",
        "urgentHelpLink": true,
        "quiz": [
          {
            "id": "baby-blues-q1",
            "prompt": "How long do baby blues usually last?",
            "choices": [
              {
                "id": "a",
                "text": "About two weeks"
              },
              {
                "id": "b",
                "text": "Six months"
              },
              {
                "id": "c",
                "text": "A year"
              }
            ],
            "correct": "a",
            "why": "NIMH describes baby blues in the first two weeks after birth."
          },
          {
            "id": "baby-blues-q2",
            "prompt": "When do most episodes of perinatal depression begin?",
            "choices": [
              {
                "id": "a",
                "text": "Before pregnancy"
              },
              {
                "id": "b",
                "text": "Within 4 to 8 weeks after birth"
              },
              {
                "id": "c",
                "text": "After the first birthday"
              }
            ],
            "correct": "b",
            "why": "NIMH gives 4 to 8 weeks after birth."
          },
          {
            "id": "baby-blues-q3",
            "prompt": "Is postpartum depression treatable?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No, it just has to pass"
              }
            ],
            "correct": "a",
            "why": "NIMH says with treatment most women feel better."
          }
        ]
      }
    ]
  },
  {
    "id": "couple",
    "title": "Your relationship",
    "why": "A baby changes the couple too. Research shows it is a common strain, and couples who talk about it early have a head start.",
    "stages": [
      "planning",
      "trying",
      "pregnancy",
      "postpartum",
      "infant",
      "toddler",
      "preschool",
      "school_age"
    ],
    "lessons": [
      {
        "id": "research-on-couples",
        "title": "What research says about couples after a baby",
        "body": [
          "Here is a fact worth knowing early: relationship satisfaction usually dips after a baby arrives, for both partners. A 2022 meta-analysis that pooled many studies found a medium decline from pregnancy to the baby's first birthday, for mothers and fathers alike, and a smaller further dip in the second year. Couples without children showed some decline over the same time, too, so part of it is simply time passing. Age, gender and how long the couple had been together did not change the picture. This is not a prediction about your relationship. It is a reminder that if things feel harder next year, you are not failing; you are having the common experience, with less sleep. Knowing that tends to make it easier to say out loud. The good news is that you have months now to build habits, like a weekly check-in, that are much harder to start when you are both exhausted."
        ],
        "minutes": 1,
        "weeks": [
          12,
          24
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "Bogdan, Turliuc, Candel (2022) Transition to Parenthood and Marital Satisfaction: A Meta-Analysis, Frontiers in Psychology",
          "url": "https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.901362/full",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "What is one small ritual of ours we want to protect after the baby comes?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "research-on-couples-q1",
            "prompt": "What happens to relationship satisfaction in the first year after a baby, on average?",
            "choices": [
              {
                "id": "a",
                "text": "It rises"
              },
              {
                "id": "b",
                "text": "It dips for both partners"
              },
              {
                "id": "c",
                "text": "It dips only for mothers"
              }
            ],
            "correct": "b",
            "why": "The meta-analysis found a medium decline for mothers and fathers."
          },
          {
            "id": "research-on-couples-q2",
            "prompt": "Does the dip mean a relationship is in trouble?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No, it is a common pattern"
              }
            ],
            "correct": "b",
            "why": "It is an average across many couples, not a verdict on yours."
          }
        ]
      },
      {
        "id": "sharing-nights",
        "title": "Planning the nights together",
        "body": [
          "Newborns feed 8 to 12 times in 24 hours, according to CDC, and that does not pause at night. Who does what at 3 a.m. is one of the most common sources of friction for new parents, mostly because nobody planned it. A plan helps, and it does not need to be fair to the minute. It needs to be clear. Some couples split the night into two shifts, so each person gets one longer stretch of sleep. Others divide by task: one feeds, the other changes, burps and settles. If one parent is breastfeeding, the other can own everything around the feed and take the early morning so the feeding parent can sleep. Agree in advance what happens on the hard nights, and check in after the first week to adjust. Writing it down sounds silly, but a shared note you made calmly in week 30 is easier to follow than a negotiation at 3 a.m."
        ],
        "minutes": 1,
        "weeks": [
          26,
          36
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "CDC: How Much and How Often to Breastfeed",
          "url": "https://www.cdc.gov/infant-toddler-nutrition/breastfeeding/how-much-and-how-often.html",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Shifts or tasks? Sketch a first version of our night plan, and pick a day to review it after the birth.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "sharing-nights-q1",
            "prompt": "How many times a day does a newborn usually feed, per CDC?",
            "choices": [
              {
                "id": "a",
                "text": "3 to 4"
              },
              {
                "id": "b",
                "text": "8 to 12"
              },
              {
                "id": "c",
                "text": "Only during the day"
              }
            ],
            "correct": "b",
            "why": "CDC gives 8 to 12 feeds in 24 hours, day and night."
          },
          {
            "id": "sharing-nights-q2",
            "prompt": "What matters most in a night plan?",
            "choices": [
              {
                "id": "a",
                "text": "That it is clear and agreed"
              },
              {
                "id": "b",
                "text": "That it is exactly 50/50"
              }
            ],
            "correct": "a",
            "why": "A clear plan beats a perfectly even one you renegotiate nightly."
          }
        ]
      },
      {
        "id": "feelings-both-ways",
        "title": "Feelings run both ways",
        "body": [
          "Pregnancy and the first year bring big feelings to both parents, and not all of them are happy. Postpartum Support International says that about 1 in 5 mothers and fathers report symptoms of depression or anxiety in the first year after birth, and the real number may be higher. These are the most common complications of having a baby, and they are treatable. You do not need a diagnosis to ask for help. Risk is higher with a personal or family history of depression or anxiety, or a big recent life event like a move or a job loss, which is worth telling your provider about now so a plan is in place. In a couple, it helps to talk about feelings in both directions, not just to ask how the pregnant partner is doing. A short weekly question, like how are you really, from each of you to the other, keeps the door open."
        ],
        "minutes": 1,
        "weeks": [
          18,
          32
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "Postpartum Support International: Perinatal Mental Health",
          "url": "https://postpartum.net/perinatal-mental-health/",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "How are you really feeling about becoming a parent? Answer it for yourself first, then for each other.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "feelings-both-ways-q1",
            "prompt": "About how many mothers and fathers report depression or anxiety symptoms in the first year?",
            "choices": [
              {
                "id": "a",
                "text": "1 in 100"
              },
              {
                "id": "b",
                "text": "1 in 5"
              },
              {
                "id": "c",
                "text": "1 in 2"
              }
            ],
            "correct": "b",
            "why": "PSI gives about 1 in 5 moms and dads."
          },
          {
            "id": "feelings-both-ways-q2",
            "prompt": "Do you need a diagnosis to reach out for help?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No"
              }
            ],
            "correct": "b",
            "why": "PSI says no diagnosis is needed to ask for help."
          }
        ]
      },
      {
        "id": "us-time",
        "title": "Keeping some time for us",
        "body": [
          "When the baby comes, the couple easily turns into a logistics team. The 2022 meta-analysis on couples found satisfaction keeps sliding a little into the second year, so it is worth deciding now what you will protect. It does not have to be a date night. It can be ten minutes on the sofa after the last feed with phones away, a walk with the stroller where you talk about anything but the baby, or a weekly check-in where each of you says one thing that went well and one thing you need. The point is to keep seeing each other as partners, not only as co-workers on a night shift. Ask family or friends to cover an hour now and then, and accept the offer when it comes. Plan it now, while you still have time to imagine what you would miss most."
        ],
        "minutes": 1,
        "weeks": [
          30,
          40
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "Bogdan, Turliuc, Candel (2022) Transition to Parenthood and Marital Satisfaction: A Meta-Analysis, Frontiers in Psychology",
          "url": "https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.901362/full",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "What would we miss most about us right now? Let's name it so we protect it.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "us-time-q1",
            "prompt": "What does the meta-analysis find in the second year after birth?",
            "choices": [
              {
                "id": "a",
                "text": "A small further decline"
              },
              {
                "id": "b",
                "text": "A full recovery"
              },
              {
                "id": "c",
                "text": "No data"
              }
            ],
            "correct": "a",
            "why": "It reports a small decline between 12 and 24 months for both."
          },
          {
            "id": "us-time-q2",
            "prompt": "Does keeping time for each other require a babysitter and a night out?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No, short regular moments count"
              }
            ],
            "correct": "b",
            "why": "Small rituals are easier to keep than big plans."
          }
        ]
      }
    ]
  },
  {
    "id": "partner",
    "title": "Being a partner",
    "why": "Partners are parents from day one. This path is for the dad, co-mother or partner who is not carrying the baby.",
    "stages": [
      "pregnancy"
    ],
    "lessons": [
      {
        "id": "show-up",
        "title": "Showing up from the start",
        "body": [
          "You are not carrying the baby, but you are already a parent, and the visits are a good place to start acting like one. Prenatal visits follow a set rhythm, about monthly until 28 weeks, then every two weeks, then weekly from 36 weeks. That makes them easy to plan around work. Coming along, even to some of them, means you hear the same information first hand, you can ask your own questions, and you will not be relying on a summary later. It also tells your partner, quietly, that this is shared. If you cannot be there, ask for a quick call afterward and keep your own notes. Small, concrete things count: owning the visit calendar, booking the time off, keeping the list of questions. You will also start to know the care team by name, which helps a lot on the day of the birth, when they are the people you will be talking to."
        ],
        "minutes": 1,
        "weeks": [
          6,
          20
        ],
        "audience": [
          "partner"
        ],
        "source": {
          "title": "NICHD: What Happens During Prenatal Visits",
          "url": "https://www.nichd.nih.gov/health/topics/preconceptioncare/conditioninfo/prenatal-visits",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Which questions do I want to ask at the next visit? Add them to our shared list.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "show-up-q1",
            "prompt": "How often are visits from 28 to 36 weeks?",
            "choices": [
              {
                "id": "a",
                "text": "Monthly"
              },
              {
                "id": "b",
                "text": "Every two weeks"
              },
              {
                "id": "c",
                "text": "Weekly"
              }
            ],
            "correct": "b",
            "why": "NICHD lists every two weeks from 28 to 36 weeks."
          },
          {
            "id": "show-up-q2",
            "prompt": "Which is a concrete way for a partner to help with visits?",
            "choices": [
              {
                "id": "a",
                "text": "Owning the calendar and the question list"
              },
              {
                "id": "b",
                "text": "Waiting to be told what happened"
              }
            ],
            "correct": "a",
            "why": "Owning a job makes the support real and visible."
          }
        ]
      },
      {
        "id": "birth-support",
        "title": "Your role in the birth room",
        "body": [
          "One thing NICHD lists among natural pain relief methods is simply continuous support: someone who stays, reassures, helps and advocates throughout labor. That someone can be you. Your job is not to know the medicine. It is to know your partner's wishes and to be calm, present and practical. Learn the pain relief options beforehand and know which ones your partner wants to try first. Help with breathing, music, position changes, water and ice. Keep track of the questions the team asks and the decisions made, so your partner does not have to hold everything. Speak up when your partner cannot, and ask the team to explain things when you are not sure. It is also fine to feel scared, useless or overwhelmed for a moment. Step out for air if you need it, then come back. A doula or another support person can share the load, which many couples find helpful."
        ],
        "minutes": 1,
        "weeks": [
          30,
          39
        ],
        "audience": [
          "partner"
        ],
        "source": {
          "title": "NICHD: Pain relief during labor and delivery",
          "url": "https://www.nichd.nih.gov/health/topics/labor-delivery/topicinfo/pain-relief",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "What do you want me to do, and not do, when labor gets hard?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "birth-support-q1",
            "prompt": "What does NICHD call the support of someone who stays through labor?",
            "choices": [
              {
                "id": "a",
                "text": "Continuous labor support"
              },
              {
                "id": "b",
                "text": "Induction"
              },
              {
                "id": "c",
                "text": "Analgesia"
              }
            ],
            "correct": "a",
            "why": "It is listed among natural pain relief methods."
          },
          {
            "id": "birth-support-q2",
            "prompt": "Do you need medical knowledge to be a good birth partner?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No, knowing their wishes and staying present matters most"
              }
            ],
            "correct": "b",
            "why": "Support is about presence and advocacy, not medicine."
          }
        ]
      },
      {
        "id": "partner-mental-health",
        "title": "Your own mental health matters",
        "body": [
          "Partners often put their own feelings aside to be the steady one. That is generous, but it is not the whole story. Postpartum Support International notes that about one in ten dads experiences postpartum depression, and 5 to 15 percent develop an anxiety disorder at some point during the pregnancy or the first year. None of this makes you a bad parent or a weak partner, and it is treatable. PSI offers a HelpLine, peer support groups for dads, and a directory of perinatal mental health providers. Looking after yourself is part of looking after your family: sleep where you can, keep a friend or two in the loop, and tell your partner how you are doing, not just how you are coping. If you notice something is off, talk to your own doctor."
        ],
        "minutes": 1,
        "weeks": [
          20,
          40
        ],
        "audience": [
          "partner"
        ],
        "source": {
          "title": "Postpartum Support International: Help for Dads",
          "url": "https://www.postpartum.net/get-help/help-for-dads/",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "How am I really doing? Tell your partner one honest thing tonight.",
        "urgentHelpLink": true,
        "quiz": [
          {
            "id": "partner-mental-health-q1",
            "prompt": "About how many dads experience postpartum depression, according to PSI?",
            "choices": [
              {
                "id": "a",
                "text": "1 in 100"
              },
              {
                "id": "b",
                "text": "1 in 10"
              },
              {
                "id": "c",
                "text": "1 in 2"
              }
            ],
            "correct": "b",
            "why": "PSI cites studies showing one in ten dads."
          },
          {
            "id": "partner-mental-health-q2",
            "prompt": "Is perinatal depression in dads treatable?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No"
              }
            ],
            "correct": "a",
            "why": "PSI stresses these conditions are treatable."
          }
        ]
      },
      {
        "id": "car-seat",
        "title": "The first drive home",
        "body": [
          "The car seat is often the partner's project, and it is a good one to finish early, well before the due date. CDC's guidance for babies is simple: use a rear-facing car seat with a harness, and keep the child rear-facing as long as possible, until they reach the seat's own weight or height limit. Never put a rear-facing seat in the front seat. Install it in the back well before the due date, read both the seat manual and the car manual, and practice buckling with a doll or a rolled towel. The first drive home is a quiet, slightly unreal moment, and you will be glad the seat was the one thing you did not have to think about."
        ],
        "minutes": 1,
        "weeks": [
          32,
          38
        ],
        "audience": [
          "partner"
        ],
        "source": {
          "title": "CDC: Child Passenger Safety, About",
          "url": "https://www.cdc.gov/child-passenger-safety/about/index.html",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "When will we install the car seat, and who will check it?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "car-seat-q1",
            "prompt": "Which way should a newborn's car seat face?",
            "choices": [
              {
                "id": "a",
                "text": "Forward"
              },
              {
                "id": "b",
                "text": "Rear-facing"
              },
              {
                "id": "c",
                "text": "Either"
              }
            ],
            "correct": "b",
            "why": "CDC says rear-facing with a harness from birth."
          },
          {
            "id": "car-seat-q2",
            "prompt": "Where should a rear-facing seat never go?",
            "choices": [
              {
                "id": "a",
                "text": "The back seat"
              },
              {
                "id": "b",
                "text": "The front seat"
              }
            ],
            "correct": "b",
            "why": "CDC: never place a rear-facing seat in the front seat."
          }
        ]
      }
    ]
  },
  {
    "id": "money-leave",
    "title": "Money, leave and paperwork",
    "why": "Leave rules and insurance deadlines are easy to miss. Sorting them out before the birth frees the first weeks for the baby.",
    "stages": [
      "planning",
      "trying",
      "pregnancy",
      "postpartum"
    ],
    "lessons": [
      {
        "id": "fmla-basics",
        "title": "Family leave: what FMLA covers",
        "body": [
          "The Family and Medical Leave Act gives eligible employees up to 12 weeks of job-protected leave for a birth and for bonding with a new child, and it applies to both parents. It covers private employers with 50 or more employees, and all public agencies and schools. You qualify if you have worked there at least 12 months, for at least 1,250 hours in the past year, at a site with 50 employees within 75 miles. Bonding leave can be taken any time in the 12 months after the birth. FMLA leave is unpaid, but it can run at the same time as paid leave your employer offers, so ask HR what you have. Give at least 30 days' notice when you can. This applies to adoptive and foster parents too, counted from the placement date. Each partner should check their own eligibility, since it can differ."
        ],
        "minutes": 1,
        "weeks": [
          12,
          24
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "DOL WHD Fact Sheet 28Q: Taking Leave for Birth, Placement and Bonding under the FMLA",
          "url": "https://www.dol.gov/agencies/whd/fact-sheets/28q-taking-leave-for-birth-placement-child",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "What does each of our employers offer? Let's both ask HR this week and compare.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "fmla-basics-q1",
            "prompt": "How many weeks of job-protected leave does FMLA give for a birth?",
            "choices": [
              {
                "id": "a",
                "text": "6"
              },
              {
                "id": "b",
                "text": "Up to 12"
              },
              {
                "id": "c",
                "text": "26"
              }
            ],
            "correct": "b",
            "why": "DOL Fact Sheet 28Q gives up to 12 workweeks."
          },
          {
            "id": "fmla-basics-q2",
            "prompt": "Is FMLA leave paid?",
            "choices": [
              {
                "id": "a",
                "text": "Yes, always"
              },
              {
                "id": "b",
                "text": "No, but it can run alongside paid leave"
              }
            ],
            "correct": "b",
            "why": "FMLA itself is unpaid."
          },
          {
            "id": "fmla-basics-q3",
            "prompt": "How much notice should you usually give for planned leave?",
            "choices": [
              {
                "id": "a",
                "text": "A week"
              },
              {
                "id": "b",
                "text": "At least 30 days"
              },
              {
                "id": "c",
                "text": "None"
              }
            ],
            "correct": "b",
            "why": "DOL asks for 30 days' notice when possible."
          }
        ]
      },
      {
        "id": "plan-leave",
        "title": "Planning leave as a couple",
        "body": [
          "Once you know what each of you is entitled to, plan the leave together. A few rules from the Department of Labor shape the choices. Bonding leave can be used any time within the first year, so one of you can stay home after the birth and the other can take over later, which stretches the time a baby has a parent at home. If you are married and work for the same employer, the two of you share a combined 12 weeks for bonding; unmarried partners each keep their own. Taking leave in pieces or as reduced hours needs your employer's agreement, unless the child has a serious health condition. Think about more than the dates: who covers the first two weeks, when the other parent is most needed, and how paid and unpaid weeks add up for your budget. Then put it on paper and send it to HR early."
        ],
        "minutes": 1,
        "weeks": [
          18,
          30
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "DOL WHD Fact Sheet 28Q: Taking Leave for Birth, Placement and Bonding under the FMLA",
          "url": "https://www.dol.gov/agencies/whd/fact-sheets/28q-taking-leave-for-birth-placement-child",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Draw our first year as a calendar: who is home when?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "plan-leave-q1",
            "prompt": "Two married spouses work for the same employer. How much FMLA bonding leave do they get?",
            "choices": [
              {
                "id": "a",
                "text": "12 weeks each"
              },
              {
                "id": "b",
                "text": "A combined 12 weeks"
              }
            ],
            "correct": "b",
            "why": "Fact Sheet 28Q limits same-employer spouses to a combined total."
          },
          {
            "id": "plan-leave-q2",
            "prompt": "Within what period must FMLA bonding leave be used?",
            "choices": [
              {
                "id": "a",
                "text": "The first 6 weeks"
              },
              {
                "id": "b",
                "text": "The first 12 months after birth"
              },
              {
                "id": "c",
                "text": "Any time before the child turns 5"
              }
            ],
            "correct": "b",
            "why": "Bonding leave must end within 12 months of the birth."
          },
          {
            "id": "plan-leave-q3",
            "prompt": "Can you take bonding leave in pieces without your employer's agreement?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No, it needs the employer's agreement"
              }
            ],
            "correct": "b",
            "why": "Intermittent bonding leave needs agreement, except for a serious health condition."
          }
        ]
      },
      {
        "id": "insurance-newborn",
        "title": "Adding the baby to your health insurance",
        "body": [
          "Your baby needs their own place on a health plan, and the clock starts at birth. If you have coverage through an employer, a federal rule gives you a special enrollment right: you must request it within 30 days of the birth, adoption or placement, and coverage then goes back to the date of birth. If you buy coverage on HealthCare.gov, having or adopting a baby is a qualifying life event, and you usually have 60 days to enroll or change plans. Check now which plan the baby will join, especially if you each have your own, and what the deductible and out-of-pocket maximum will look like. A second federal law, the Newborns' Act, protects the hospital stay. Plans that cover maternity cannot limit the stay to less than 48 hours after a vaginal birth or 96 hours after a cesarean, though you and your provider can decide to go home sooner."
        ],
        "minutes": 1,
        "weeks": [
          28,
          38
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "DOL EBSA: Protections for Newborns, Adopted Children, and New Parents",
          "url": "https://www.dol.gov/node/63379",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Whose plan will the baby join? Set a reminder for the week after the due date.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "insurance-newborn-q1",
            "prompt": "How long do you have to enroll a newborn in an employer plan?",
            "choices": [
              {
                "id": "a",
                "text": "7 days"
              },
              {
                "id": "b",
                "text": "30 days"
              },
              {
                "id": "c",
                "text": "1 year"
              }
            ],
            "correct": "b",
            "why": "DOL says request special enrollment within 30 days."
          },
          {
            "id": "insurance-newborn-q2",
            "prompt": "When does that coverage start?",
            "choices": [
              {
                "id": "a",
                "text": "The day you enroll"
              },
              {
                "id": "b",
                "text": "Back to the date of birth"
              }
            ],
            "correct": "b",
            "why": "Special enrollment coverage is retroactive to the birth."
          },
          {
            "id": "insurance-newborn-q3",
            "prompt": "What is the minimum covered hospital stay after a vaginal birth?",
            "choices": [
              {
                "id": "a",
                "text": "24 hours"
              },
              {
                "id": "b",
                "text": "48 hours"
              },
              {
                "id": "c",
                "text": "1 week"
              }
            ],
            "correct": "b",
            "why": "The Newborns' Act sets 48 hours, or 96 after a cesarean."
          }
        ]
      },
      {
        "id": "paperwork-list",
        "title": "The paperwork list",
        "body": [
          "The weeks after the birth are not the time to discover a form. A short list now saves a lot of phone calls later. Start with the baby's health coverage: on HealthCare.gov a birth or adoption opens a special enrollment period, and you usually have 60 days to sign up, while employer plans need a request within 30 days. Next, leave: confirm your dates in writing with each employer and note what pay comes when. Then the hospital paperwork: ask before the birth how the birth certificate is handled where you will deliver and what you need to bring. Keep everything in one shared folder, digital or paper, so either of you can find it when the other is asleep. Finally, choose a pediatrician before the birth, so you know who will see the baby once you are home. Splitting this list between you, with names next to each task, is a small act of teamwork."
        ],
        "minutes": 1,
        "weeks": [
          32,
          40
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "HealthCare.gov: Special Enrollment Period (glossary)",
          "url": "https://www.healthcare.gov/glossary/special-enrollment-period/",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [
          {
            "title": "DOL EBSA: Protections for Newborns, Adopted Children, and New Parents",
            "url": "https://www.dol.gov/node/63379",
            "checkedAt": "2026-11-14"
          }
        ],
        "talkPrompt": "Let's split the paperwork list and put a name next to every task.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "paperwork-list-q1",
            "prompt": "How long is the usual HealthCare.gov special enrollment window after a birth?",
            "choices": [
              {
                "id": "a",
                "text": "10 days"
              },
              {
                "id": "b",
                "text": "60 days"
              },
              {
                "id": "c",
                "text": "6 months"
              }
            ],
            "correct": "b",
            "why": "HealthCare.gov says you usually have 60 days."
          },
          {
            "id": "paperwork-list-q2",
            "prompt": "Why keep one shared paperwork folder?",
            "choices": [
              {
                "id": "a",
                "text": "So either parent can find things"
              },
              {
                "id": "b",
                "text": "It is legally required"
              }
            ],
            "correct": "a",
            "why": "Shared access means nothing waits on one person."
          }
        ]
      }
    ]
  },
  {
    "id": "mental-health",
    "title": "Mental health for both of you",
    "why": "Feelings in pregnancy and after are part of health, for both parents. Knowing what is common and where help is makes it easier to reach out.",
    "stages": [
      "planning",
      "trying",
      "pregnancy",
      "postpartum",
      "infant",
      "toddler",
      "preschool",
      "school_age"
    ],
    "lessons": [
      {
        "id": "whats-common",
        "title": "What is common, and what is help-worthy",
        "body": [
          "Becoming a parent shakes up sleep, hormones, work, money and identity all at once, so some ups and downs are expected. Mental health conditions around pregnancy are also very common: Postpartum Support International calls them the number one complication of childbearing, and about 1 in 5 mothers and fathers report depression or anxiety symptoms in the first year. They can start during pregnancy, not only after. They can show up as sadness, but also as anxiety or losing interest, joy or pleasure in things you used to enjoy. Some things raise the chances, such as a personal or family history of depression, anxiety, bipolar disorder or OCD, or a big recent loss or move. If any of that applies to you, tell your provider early, so a plan is ready. You do not need to be sure or have a diagnosis to ask for help."
        ],
        "minutes": 1,
        "weeks": [
          8,
          24
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "Postpartum Support International: Perinatal Mental Health",
          "url": "https://postpartum.net/perinatal-mental-health/",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Is there anything in our own histories we should tell the provider about now?",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "whats-common-q1",
            "prompt": "What does PSI call perinatal mental health conditions?",
            "choices": [
              {
                "id": "a",
                "text": "Rare"
              },
              {
                "id": "b",
                "text": "The number one complication of childbearing"
              },
              {
                "id": "c",
                "text": "A problem only after birth"
              }
            ],
            "correct": "b",
            "why": "PSI uses those words on its perinatal mental health page."
          },
          {
            "id": "whats-common-q2",
            "prompt": "Can these conditions start during pregnancy?",
            "choices": [
              {
                "id": "a",
                "text": "Yes"
              },
              {
                "id": "b",
                "text": "No, only after birth"
              }
            ],
            "correct": "a",
            "why": "PSI says symptoms can start any time in the perinatal period."
          }
        ]
      },
      {
        "id": "treatment-works",
        "title": "Help that works",
        "body": [
          "If either of you does struggle, the hopeful part is that perinatal depression is treatable, and with treatment most people feel better. NIMH describes the main options. Talk therapy, especially cognitive behavioral therapy and interpersonal therapy, teaches new ways to handle thoughts, habits and relationships. Antidepressants can help, alone or together with therapy; they usually take four to eight weeks to work, and sleep and appetite often improve before mood does. There are also newer medicines approved specifically for postpartum depression. Decisions about medicine in pregnancy or while breastfeeding are made with a provider, weighing the risks and benefits for both parent and baby, so never start or stop a medicine on your own. Support matters too: sleep, practical help at home, and groups of people who have been there. The first step is a conversation with a doctor, midwife or mental health professional. Your partner can help make the appointment."
        ],
        "minutes": 1,
        "weeks": [
          20,
          36
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NIMH: Perinatal Depression",
          "url": "https://www.nimh.nih.gov/health/publications/perinatal-depression",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "If one of us needed help, who would we call first? Write the name down together.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "treatment-works-q1",
            "prompt": "Which therapies does NIMH name for perinatal depression?",
            "choices": [
              {
                "id": "a",
                "text": "CBT and interpersonal therapy"
              },
              {
                "id": "b",
                "text": "Only medication"
              },
              {
                "id": "c",
                "text": "Only rest"
              }
            ],
            "correct": "a",
            "why": "NIMH lists both as evidence-based."
          },
          {
            "id": "treatment-works-q2",
            "prompt": "How long do antidepressants usually take to work?",
            "choices": [
              {
                "id": "a",
                "text": "A day"
              },
              {
                "id": "b",
                "text": "About 4 to 8 weeks"
              },
              {
                "id": "c",
                "text": "Six months"
              }
            ],
            "correct": "b",
            "why": "NIMH gives 4 to 8 weeks."
          }
        ]
      },
      {
        "id": "where-to-call",
        "title": "Where to call, day or night",
        "body": [
          "It is easier to reach out when the number is already in your phone. The National Maternal Mental Health Hotline is free, confidential and open 24 hours a day, 7 days a week, by call or text at 1-833-852-6262 (1-833-9-TLC-MAMA), in English and Spanish, for mothers and their families. Postpartum Support International runs a HelpLine at 1-800-944-4773 for moms and dads, where a trained volunteer gets back to you with support and local resources. If anyone is in crisis or having thoughts of suicide, call or text 988, and in a life-threatening emergency call 911. The Urgent help screen in this app is always one tap away. Save them in both phones tonight, even if you never need them. Knowing they are there is part of feeling ready."
        ],
        "minutes": 1,
        "weeks": [
          20,
          40
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "NIMH: Perinatal Depression",
          "url": "https://www.nimh.nih.gov/health/publications/perinatal-depression",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [
          {
            "title": "Postpartum Support International: Help for Dads",
            "url": "https://www.postpartum.net/get-help/help-for-dads/",
            "checkedAt": "2026-11-14"
          }
        ],
        "talkPrompt": "Let's save the hotline numbers in both our phones right now.",
        "urgentHelpLink": true,
        "quiz": [
          {
            "id": "where-to-call-q1",
            "prompt": "Which number is the National Maternal Mental Health Hotline?",
            "choices": [
              {
                "id": "a",
                "text": "1-833-852-6262"
              },
              {
                "id": "b",
                "text": "1-800-555-0100"
              },
              {
                "id": "c",
                "text": "411"
              }
            ],
            "correct": "a",
            "why": "NIMH lists 1-833-9-TLC-MAMA (1-833-852-6262)."
          },
          {
            "id": "where-to-call-q2",
            "prompt": "When is the hotline open?",
            "choices": [
              {
                "id": "a",
                "text": "Weekdays only"
              },
              {
                "id": "b",
                "text": "24 hours a day, 7 days a week"
              }
            ],
            "correct": "b",
            "why": "NIMH says counselors are available 24/7."
          }
        ]
      },
      {
        "id": "check-in-habit",
        "title": "A five-minute weekly check-in",
        "body": [
          "Big conversations are hard to start, and small ones are easy to skip. A weekly check-in solves both. Pick a regular slot, like Sunday evening, and take five minutes each. Rate your week from one to five, name one thing that felt good and one thing that felt heavy, and say one thing you need from the other person. Listen without fixing. Postpartum Support International lists social support and practical help, like prioritizing sleep, time for yourself and asking for help, among the things that support perinatal mental health, and a check-in is a simple way to make room for them. It also means that if one of you starts to slide, the other notices sooner. Keep it light most weeks. Use the mood check-in in this app if writing is easier than talking, and share the entries you want to share. Your diary stays private unless you choose otherwise."
        ],
        "minutes": 1,
        "weeks": [
          12,
          40
        ],
        "audience": [
          "mother",
          "partner"
        ],
        "source": {
          "title": "Postpartum Support International: Perinatal Mental Health",
          "url": "https://postpartum.net/perinatal-mental-health/",
          "checkedAt": "2026-11-14"
        },
        "extraSources": [],
        "talkPrompt": "Let's do our first check-in now: one to five, one good thing, one heavy thing, one need.",
        "urgentHelpLink": false,
        "quiz": [
          {
            "id": "check-in-habit-q1",
            "prompt": "What does PSI list among supports for perinatal mental health?",
            "choices": [
              {
                "id": "a",
                "text": "Social support and practical help"
              },
              {
                "id": "b",
                "text": "Avoiding all conversation"
              },
              {
                "id": "c",
                "text": "Working longer hours"
              }
            ],
            "correct": "a",
            "why": "PSI names social support and practical help, such as sleep and asking for help."
          },
          {
            "id": "check-in-habit-q2",
            "prompt": "What is the main rule while your partner talks in a check-in?",
            "choices": [
              {
                "id": "a",
                "text": "Fix the problem right away"
              },
              {
                "id": "b",
                "text": "Listen without fixing"
              }
            ],
            "correct": "b",
            "why": "Feeling heard comes before solutions."
          }
        ]
      }
    ]
  }
];

export const talkPool: { id: string; text: string; weeks: [number, number] }[] = [
  {
    "id": "p01",
    "text": "When did it first feel real for each of you? Tell the story from your side.",
    "weeks": [
      4,
      12
    ]
  },
  {
    "id": "p03",
    "text": "Which traditions from your own childhoods do you want to keep, and which would you quietly drop?",
    "weeks": [
      6,
      16
    ]
  },
  {
    "id": "p05",
    "text": "Who do we tell, when, and how? Make a short list together.",
    "weeks": [
      8,
      20
    ]
  },
  {
    "id": "p06",
    "text": "Each write five names you love, then swap lists. Circle one from the other's list.",
    "weeks": [
      12,
      24
    ]
  },
  {
    "id": "p08",
    "text": "What did your parents get right? What do you want to do differently?",
    "weeks": [
      14,
      26
    ]
  },
  {
    "id": "p09",
    "text": "How do we each feel about finding out the sex before the birth, or keeping it a surprise?",
    "weeks": [
      14,
      26
    ]
  },
  {
    "id": "p11",
    "text": "Which songs or books do we want the baby to hear from us first?",
    "weeks": [
      18,
      30
    ]
  },
  {
    "id": "p12",
    "text": "How much leave can each of us take, and how do we want to stagger it?",
    "weeks": [
      18,
      30
    ]
  },
  {
    "id": "p14",
    "text": "What will the nursery corner look like? Pick one thing each that has to be there.",
    "weeks": [
      20,
      34
    ]
  },
  {
    "id": "p15",
    "text": "Who are the three people we can call at 2 a.m. if we need help?",
    "weeks": [
      22,
      34
    ]
  },
  {
    "id": "p17",
    "text": "What should the baby call each of our parents? Ask them what they would like.",
    "weeks": [
      24,
      36
    ]
  },
  {
    "id": "p18",
    "text": "Which chores does each of us own today, and which will change after the birth?",
    "weeks": [
      24,
      36
    ]
  },
  {
    "id": "p20",
    "text": "How do we want to split nights in the first weeks: shifts, or tasks?",
    "weeks": [
      28,
      38
    ]
  },
  {
    "id": "p21",
    "text": "Visitors in the first two weeks: who, how long, and who says no if we are tired?",
    "weeks": [
      28,
      38
    ]
  },
  {
    "id": "p23",
    "text": "Finish the letter to the baby together. Each add one paragraph.",
    "weeks": [
      30,
      40
    ]
  },
  {
    "id": "p24",
    "text": "What do we each want in the birth room, and what should the partner speak up for?",
    "weeks": [
      30,
      40
    ]
  },
  {
    "id": "p25",
    "text": "Shortlist the names. Say each one out loud with our family name. Which feels like them?",
    "weeks": [
      30,
      40
    ]
  },
  {
    "id": "p27",
    "text": "Is the hospital bag packed? What is the one thing each of us would forget?",
    "weeks": [
      32,
      40
    ]
  },
  {
    "id": "p28",
    "text": "Who walks the dog, feeds the cat or picks up older kids if labor starts at night?",
    "weeks": [
      34,
      40
    ]
  },
  {
    "id": "p29",
    "text": "What do we want to do as a couple in the last weeks before the baby comes?",
    "weeks": [
      36,
      40
    ]
  },
  {
    "id": "p31",
    "text": "What is one thing you love about how your partner is handling this pregnancy?",
    "weeks": [
      4,
      40
    ]
  }
];
