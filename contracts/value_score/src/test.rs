#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn setup() -> (Env, ValueScoreClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ValueScore, ());
    let client = ValueScoreClient::new(&env, &contract_id);
    client.initialize();
    (env, client)
}

#[test]
fn test_initialize() {
    let (_env, _client) = setup();
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize() {
    let (_env, client) = setup();
    client.initialize();
}

#[test]
fn test_submit_single_score() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::EngineeringQuality, &85, &30);

    let score = client.get_score(&1).unwrap();
    assert_eq!(score.overall_score, 85);
    assert_eq!(score.category_scores.len(), 1);
    assert_eq!(score.total_evaluations, 1);
}

#[test]
fn test_submit_multiple_scores_weighted() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::EngineeringQuality, &80, &30);
    client.submit_score(&evaluator, &1, &ScoreCategory::BudgetEfficiency, &90, &20);
    client.submit_score(&evaluator, &1, &ScoreCategory::CitizenSatisfaction, &70, &50);

    let score = client.get_score(&1).unwrap();
    assert_eq!(score.category_scores.len(), 3);

    let expected = (80 * 30 + 90 * 20 + 70 * 50) / (30 + 20 + 50);
    assert_eq!(score.overall_score, expected);
}

#[test]
fn test_update_existing_category() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::Safety, &50, &40);
    client.submit_score(&evaluator, &1, &ScoreCategory::Safety, &80, &40);

    let score = client.get_score(&1).unwrap();
    assert_eq!(score.category_scores.len(), 1);
    assert_eq!(score.overall_score, 80);
}

#[test]
#[should_panic(expected = "score must be 0-100")]
fn test_score_out_of_range() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::Safety, &150, &10);
}

#[test]
#[should_panic(expected = "weight must be 0-100")]
fn test_weight_out_of_range() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::Safety, &50, &150);
}

#[test]
fn test_get_overall_score() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    assert_eq!(client.get_overall_score(&1), 0);

    client.submit_score(&evaluator, &1, &ScoreCategory::Transparency, &75, &100);

    assert_eq!(client.get_overall_score(&1), 75);
}

#[test]
fn test_get_category_score() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::Compliance, &95, &40);

    let cs = client.get_category_score(&1, &ScoreCategory::Compliance).unwrap();
    assert_eq!(cs.score, 95);
    assert_eq!(cs.weight, 40);
}

#[test]
fn test_get_category_score_not_found() {
    let (_env, client) = setup();

    let result = client.get_category_score(&1, &ScoreCategory::Compliance);
    assert!(result.is_none());
}

#[test]
fn test_department_index() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::EngineeringQuality, &80, &50);
    let caller = Address::generate(&env);
    client.update_department_index(&caller, &make_string(&env, "DPWH"), &1);

    let entry = client.get_department_index(&make_string(&env, "DPWH")).unwrap();
    assert_eq!(entry.avg_score, 80);
    assert_eq!(entry.pvo_count, 1);
}

#[test]
fn test_department_index_multiple_pvos() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);
    let dept = make_string(&env, "DPWH");

    client.submit_score(&evaluator, &1, &ScoreCategory::EngineeringQuality, &80, &50);
    let caller = Address::generate(&env);
    client.update_department_index(&caller, &dept, &1);

    client.submit_score(&evaluator, &2, &ScoreCategory::EngineeringQuality, &90, &50);
    client.update_department_index(&caller, &dept, &2);

    let entry = client.get_department_index(&dept).unwrap();
    assert_eq!(entry.pvo_count, 2);
    assert_eq!(entry.avg_score, 85);
}

#[test]
fn test_get_all_department_indices() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::EngineeringQuality, &80, &50);
    let caller = Address::generate(&env);
    client.update_department_index(&caller, &make_string(&env, "DPWH"), &1);

    client.submit_score(&evaluator, &2, &ScoreCategory::EngineeringQuality, &70, &50);
    let caller = Address::generate(&env);
    client.update_department_index(&caller, &make_string(&env, "DOH"), &2);

    let indices = client.get_all_department_indices();
    assert_eq!(indices.len(), 2);
}

#[test]
fn test_get_scored_pvo_count() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    assert_eq!(client.get_scored_pvo_count(), 0);

    client.submit_score(&evaluator, &1, &ScoreCategory::Safety, &80, &50);
    assert_eq!(client.get_scored_pvo_count(), 1);

    client.submit_score(&evaluator, &2, &ScoreCategory::Safety, &90, &50);
    assert_eq!(client.get_scored_pvo_count(), 2);
}

#[test]
fn test_all_score_categories() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    let categories = [
        ScoreCategory::EngineeringQuality,
        ScoreCategory::BudgetEfficiency,
        ScoreCategory::SchedulePerformance,
        ScoreCategory::EnvironmentalImpact,
        ScoreCategory::Safety,
        ScoreCategory::FloodReduction,
        ScoreCategory::CitizenSatisfaction,
        ScoreCategory::Transparency,
        ScoreCategory::Compliance,
        ScoreCategory::MaintenanceReadiness,
    ];

    for (i, cat) in categories.iter().enumerate() {
        client.submit_score(&evaluator, &1, cat, &((i as u32 + 1) * 10), &10);
    }

    let score = client.get_score(&1).unwrap();
    assert_eq!(score.category_scores.len(), 10);
}

#[test]
fn test_zero_weight_handling() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::Safety, &80, &0);

    let score = client.get_score(&1).unwrap();
    assert_eq!(score.overall_score, 0);
}

#[test]
fn test_multiple_pvo_isolation() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::Safety, &90, &50);
    client.submit_score(&evaluator, &2, &ScoreCategory::Safety, &40, &50);

    assert_eq!(client.get_overall_score(&1), 90);
    assert_eq!(client.get_overall_score(&2), 40);
}

#[test]
fn test_score_boundary_zero() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::Safety, &0, &50);
    assert_eq!(client.get_overall_score(&1), 0);
}

#[test]
fn test_score_boundary_hundred() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    client.submit_score(&evaluator, &1, &ScoreCategory::Safety, &100, &50);
    assert_eq!(client.get_overall_score(&1), 100);
}

#[test]
fn test_all_categories_weighted_average() {
    let (env, client) = setup();
    let evaluator = Address::generate(&env);

    let cats = [
        ScoreCategory::EngineeringQuality,
        ScoreCategory::BudgetEfficiency,
        ScoreCategory::SchedulePerformance,
        ScoreCategory::EnvironmentalImpact,
        ScoreCategory::Safety,
        ScoreCategory::FloodReduction,
        ScoreCategory::CitizenSatisfaction,
        ScoreCategory::Transparency,
        ScoreCategory::Compliance,
        ScoreCategory::MaintenanceReadiness,
    ];

    for (i, cat) in cats.iter().enumerate() {
        client.submit_score(&evaluator, &1, cat, &((i as u32 + 1) * 10), &10);
    }

    let score = client.get_score(&1).unwrap();
    assert_eq!(score.category_scores.len(), 10);
    assert!(score.overall_score > 0);
    assert!(score.overall_score <= 100);
}
