// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use std::collections::HashSet;

const CHAR_THRESHOLD: usize = 500;
const CHANGE_RATIO_THRESHOLD: f64 = 0.20;

pub fn is_significant_change(old_content: &str, new_content: &str) -> bool {
    let len_diff = if old_content.len() > new_content.len() {
        old_content.len() - new_content.len()
    } else {
        new_content.len() - old_content.len()
    };

    if len_diff > CHAR_THRESHOLD {
        return true;
    }

    let ratio = compute_change_ratio(old_content, new_content);
    ratio > CHANGE_RATIO_THRESHOLD
}

fn compute_change_ratio(old_content: &str, new_content: &str) -> f64 {
    let old_lines: Vec<&str> = old_content.lines().collect();
    let new_lines: Vec<&str> = new_content.lines().collect();

    let total = old_lines.len().max(new_lines.len());
    if total == 0 {
        return 0.0;
    }

    let old_set: HashSet<&str> = old_lines.iter().copied().collect();
    let new_set: HashSet<&str> = new_lines.iter().copied().collect();

    let removed = old_set.difference(&new_set).count();
    let added = new_set.difference(&old_set).count();
    let changed = removed + added;

    changed as f64 / (total as f64 * 2.0).min(changed as f64 + total as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_content_is_not_significant() {
        assert!(!is_significant_change("hello world", "hello world"));
    }

    #[test]
    fn large_addition_is_significant() {
        let old = "short";
        let new = &"x".repeat(600);
        assert!(is_significant_change(old, new));
    }

    #[test]
    fn small_change_is_not_significant() {
        let old = "line1\nline2\nline3\nline4\nline5";
        let new = "line1\nline2\nline3\nline4\nline5a";
        assert!(!is_significant_change(old, new));
    }

    #[test]
    fn many_changed_lines_is_significant() {
        let old = (0..10).map(|i| format!("line{}", i)).collect::<Vec<_>>().join("\n");
        let new = (0..10).map(|i| format!("changed{}", i)).collect::<Vec<_>>().join("\n");
        assert!(is_significant_change(&old, &new));
    }
}
