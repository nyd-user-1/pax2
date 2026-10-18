library(tidyverse)


defined_term_names <- c(
  "candidate_facts"="Candidate facts",
  "candidate_facts_specificity"="Specificity: Candidate facts",
  "emotion_anger"="Emotion: Anger",
  "emotion_disgust"="Emotion: Disgust",
  "emotion_enthusiasm"="Emotion: Enthusiasm",
  "emotion_fear"="Emotion: Fear",
  "emotion_humor"="Emotion: Humor",
  "emotion_pride"="Emotion: Pride",
  "emotion_sadness"="Emotion: Sadness",
  "emotion_somber"="Emotion: Somber",
  "explicit_vote_for"="Explicit vote for",
  "fact_cite_na"="No fact",
  "fact_cite_no"="Uncited fact",
  "fact_cite_only"="Cited fact (where fact present)",
  "fact_cite_yes"="Cited fact",
  "fact_new_na"="No fact",
  "fact_new_no"="Familiar fact",
  "fact_new_only"="New fact (where fact present)",
  "fact_new_yes"="New fact",
  "fact_policy"="Policy facts",
  "fact_valence"="Candidate facts",
  "how_persuasive"="How persuasive",
  "how_pushy" = "How pushy",
  "how_specific_candidate_fact"="Specificity: Candidate facts",
  "how_specific_policy_fact"="Specificity: Policy facts",
  "how_specific_candidate_fact_impute"="Specificity: Candidate facts",
  "how_specific_policy_fact_impute"="Specificity: Policy facts",
  "intercept"="Intercept",
  "issue_abortion"="Issue: Abortion",
  "issue_blm_race"="Issue: BLM/Race",
  "issue_climate"="Issue: Climate",
  "issue_corrupt"="Issue: Corruption",
  "issue_covid"="Issue: COVID-19",
  "issue_decency"="Issue: Decency",
  "issue_economy"="Issue: Economy",
  "issue_education"="Issue: Education",
  "issue_foreign_p"="Issue: Foreign Policy",
  "issue_healthcare"="Issue: Healthcare",
  "issue_immigrant"="Issue: Immigration",
  "issue_taxes"="Issue: Taxes",
  "mentions_biden"="Mentions: Biden",
  "mentions_party"="Mentions: Party",
  "mentions_trump"="Mentions: Trump",
  "messenger_black"="Messenger: Black",
  "messenger_celebrity"="Messenger: Celebrity",
  "messenger_elderly"="Messenger: Elderly",
  "messenger_every_people"="Messenger: Everyday people",
  "messenger_female"="Messenger: Female",
  "messenger_healthcare"="Messenger: Healthcare worker",
  "messenger_latinx"="Messenger: Latinx",
  "messenger_male"="Messenger: Male",
  "messenger_middle_aged"="Messenger: Middle aged",
  "messenger_politician"="Messenger: Politician",
  "messenger_republican"="Messenger: Republican",
  "messenger_veteran"="Messenger: Veteran",
  "messenger_white"="Messenger: White",
  "messenger_young_adult"="Messenger: Young adult",
  "narration_advocate_opinions"="Narration: Advocate opinions",
  "narration_explain_facts"="Narration: Facts",
  "narration_personal_story"="Narration: Personal story",
  "narration_song"="Narration: Song",
  "policy_facts"="Policy facts",
  "policy_facts_specificity"="Specificity: Policy facts",
  "primary_focus_candidate"="Primary focus: Candidate",
  "primary_focus_issues"="Primary focus: Issues",
  "primary_focus_valence"="Primary focus: Candidate",
  "production_value_high"="Production value: High",
  "race_levelCongress" = "Race: Congress",
  "race_levelGov" = "Race: Gov",
  "race_levelOther" = "Race: Other",
  "race_levelStateLeg" = "Race: StateLeg",
  "race_levelRunoff" = "Race: GA Runoff",
  "standardized_log_time_to_election"="Time to election",
  "style_amateur"="Style: Amateur",
  "style_animation"="Style: Animation",
  "style_news_clips"="Style: News clips",
  "style_photo_montage"="Style: Photo montage",
  "style_regular_scenes"="Style: Regular scenes",
  "style_text_on_screen"="Style: Text on screen",
  "technique_neg_name"="Technique: Negative name-calling",
  "technique_neg_testimonial"="Technique: Negative testimonial",
  "technique_neg_transfer"="Technique: Negative transfer of association",
  "technique_plain_folks"="Technique: Plain folks",
  "technique_pos_name"="Technique: Positive name-calling",
  "technique_pos_testimonial"="Technique: Positive testimonial",
  "technique_pos_transfer"="Technique: Positive transfer of association",
  "tone_contrast"="Primary tone: Contrast",
  "tone_positive"="Primary tone: Positive",
  "log_days_until_election"="Days until election (log scale)"
)

defined_outcome_names <- c(
  "favorability" = "Favorability",
  "votechoice" = "Vote choice",
  "votechoice_dichotomized" = "Vote choice (dichotomized)"
)


defined_metaregressions <- bind_rows(
  # Overall ATE
  tibble(metareg_group="overall", metareg_name="Overall", formula="~ 1", terms_to_test="intercept"),
  
  # 2020: Replications of positive 2018 tests
  tibble(metareg_group="primary",   metareg_name="Primary focus",         formula="~ primary_focus_issues + primary_focus_candidate"),
  tibble(metareg_group="primary",   metareg_name="Fact type",             formula="~ candidate_facts + policy_facts + primary_focus_issues + primary_focus_candidate",  terms_to_test="candidate_facts,policy_facts"),
  tibble(metareg_group="secondary", metareg_name="Messenger: politician", formula="~ messenger_politician"),
  tibble(metareg_group="secondary", metareg_name="Explicit vote for",     formula="~ explicit_vote_for"),
  tibble(metareg_group="secondary", metareg_name="Emotion: anger",        formula="~ emotion_anger"),
  
  # 2020: New tests that are of primary interest
  tibble(metareg_group="new", metareg_name="Pushiness",                    formula="~ how_pushy"),
  tibble(metareg_group="new", metareg_name="Issue: BLM/Race",              formula="~ issue_blm_race"),
  tibble(metareg_group="new", metareg_name="Issue: COVID-19",              formula="~ issue_covid"),
  tibble(metareg_group="new", metareg_name="Issue: Decency",               formula="~ issue_decency"),
  tibble(metareg_group="new", metareg_name="Messenger: Republican",        formula="~ messenger_republican"),
  tibble(metareg_group="new", metareg_name="Messenger: Everyday people",   formula="~ messenger_every_people"),
  tibble(metareg_group="new", metareg_name="Messenger: Healthcare worker", formula="~ messenger_healthcare"),
  
  # 2020: Exploratory tests, replication of null 2018 tests
  tibble(metareg_group="primary",   metareg_name="Persuasive techniques",            formula="~ technique_neg_name + technique_pos_name + technique_pos_transfer + technique_neg_transfer + technique_pos_testimonial + technique_neg_testimonial + technique_plain_folks"),
  tibble(metareg_group="primary",   metareg_name="New fact (where fact present)",    formula="~ fact_new_only + primary_focus_candidate + primary_focus_issues", terms_to_test="fact_new_only"),
  tibble(metareg_group="secondary", metareg_name="Primary tone",                     formula="~ tone_positive + tone_contrast"),
  tibble(metareg_group="secondary", metareg_name="Specificity: Candidate attribute", formula="~ how_specific_candidate_fact"),
  tibble(metareg_group="secondary", metareg_name="Specificity: Issue fact",          formula="~ how_specific_policy_fact"),
  tibble(metareg_group="secondary", metareg_name="Production value",                 formula="~ production_value_high"),
  tibble(metareg_group="secondary", metareg_name="Cited fact (where fact present)",  formula="~ fact_cite_only + primary_focus_candidate + primary_focus_issues", terms_to_test="fact_cite_only"),
  
  tibble(metareg_group="other", metareg_name="Time to election", formula="~ log_days_until_election"),
  tibble(metareg_group="other", metareg_name="Mentions party",   formula="~ mentions_party"),
  tibble(metareg_group="other", metareg_name="Mentions Trump",   formula="~ mentions_trump"),
  tibble(metareg_group="other", metareg_name="Mentions Biden",   formula="~ mentions_biden"),
  
  tibble(metareg_group="omnibus", metareg_name="All primary", formula = "~primary_focus_issues + primary_focus_candidate + candidate_facts + policy_facts + messenger_politician + explicit_vote_for + emotion_anger + technique_neg_name + technique_pos_name + technique_pos_transfer + technique_neg_transfer + technique_pos_testimonial + technique_neg_testimonial + technique_plain_folks + fact_new_yes"),
  tibble(metareg_group="omnibus", metareg_name="All primary and secondary", formula = "~primary_focus_issues + primary_focus_candidate + candidate_facts + policy_facts + messenger_politician + explicit_vote_for + emotion_anger + technique_neg_name + technique_pos_name + technique_pos_transfer + technique_neg_transfer + technique_pos_testimonial + technique_neg_testimonial + technique_plain_folks + fact_new_yes + how_specific_candidate_fact_impute + how_specific_policy_fact_impute + production_value_high + fact_cite_yes"),
  tibble(metareg_group="omnibus", metareg_name="All primary, secondary and new", formula = "~primary_focus_issues + primary_focus_candidate + candidate_facts + policy_facts + messenger_politician + explicit_vote_for + emotion_anger + technique_neg_name + technique_pos_name + technique_pos_transfer + technique_neg_transfer + technique_pos_testimonial + technique_neg_testimonial + technique_plain_folks + fact_new_yes + how_specific_candidate_fact_impute + how_specific_policy_fact_impute + production_value_high + fact_cite_yes + how_pushy + issue_blm_race + issue_covid + issue_decency + messenger_republican + messenger_every_people + messenger_healthcare"),
  
  # Non-prereg
  map_dfr(c("disgust", "enthusiasm", "fear", "humor", "pride", "sadness", "somber"), function(emotion) {
    tibble(metareg_group=if(emotion=="enthusiasm") "secondary" else "other", metareg_name=str_glue("Emotion: {emotion}"), formula=str_glue("~ emotion_{emotion}"))}),
  
  map_dfr(c("young_adult", "middle_aged", "elderly", "male", "female", "white", "black", "latinx", "veteran", "celebrity"), function(messenger) {
    tibble(metareg_group=if(messenger=="female") "secondary" else "other", metareg_name=str_glue("Messenger: {messenger}"), formula=str_glue("~ messenger_{messenger}"))}),
  
  map_dfr(c("healthcare", "taxes", "abortion", "climate", "corrupt", "economy", "education", "foreign_p", "immigrant"), function(issue) {
    tibble(metareg_group="other", metareg_name=str_glue("Issue: {issue}"), formula=str_glue("~ issue_{issue}"))}),
  
  map_dfr(c("explain_facts", "personal_story", "advocate_opinions", "song"), function(narration) {
    tibble(metareg_group="other", metareg_name=str_glue("Narration: {narration}"), formula=str_glue("~ narration_{narration}"))}),
  
  map_dfr(c("regular_scenes", "amateur", "animation", "text_on_screen", "news_clips", "photo_montage"), function(style) {
    tibble(metareg_group="other", metareg_name=str_glue("Style: {style}"), formula=str_glue("~ style_{style}"))}),
) %>%
  mutate(
    metareg_group_name = case_when(
      metareg_group=="overall"   ~ "Overall",
      metareg_group=="primary"   ~ "2018 Primary hypotheses",
      metareg_group=="secondary" ~ "2018 Secondary hypotheses",
      metareg_group=="new"       ~ "2020 New hypotheses",
      metareg_group=="other"     ~ "Other"),
    terms_to_test = case_when(!is.na(terms_to_test) ~ terms_to_test, T ~ formula %>% str_replace_all(c("~| "="", "\\+"=","))))



get_comparison_formula <- function(formula, terms_to_test) {
  if(str_detect(terms_to_test, "intercept")) return(NA)
  str_split(terms_to_test, ",")[[1]] %>% reduce(~str_replace_all(.x, fixed(.y), "1"), .init=formula) %>% str_replace_all(" *\\+ *1", "")
}
defined_metaregressions <- defined_metaregressions %>%
  rowwise() %>% mutate(comparison_formula = get_comparison_formula(formula, terms_to_test)) %>% ungroup()
