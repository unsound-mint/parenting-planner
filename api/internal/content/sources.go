package content

// SourceRoots returns every catalog in this package that carries sources, for
// the guidance package to collect into the one public sources page. Add a new
// catalog here when you add one, or its sources will be missing from that page.
func SourceRoots() []any {
	return []any{
		guides, library, sizeSources, growthWeeks, stageNow, familyHub,
		weeklyReads, safetyReference, learnPaths, PracticeQuestions(), PracticeScenarios(),
	}
}
