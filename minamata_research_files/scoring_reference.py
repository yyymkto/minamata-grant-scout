"""
水俣市 補助金マッチング — 配点リファレンス実装
minamata_profile.yaml を読み込み、補助金ごとの「地域適合スコア（0〜100）」と内訳を返す。

使い方:
    python scoring_reference.py            # サンプル補助金で動作確認
    from scoring_reference import load_profile, score_subsidy
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import yaml

PROFILE_PATH = Path(__file__).with_name("minamata_profile.yaml")


def load_profile(path: Path = PROFILE_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def industry_base(profile: dict, key: str) -> float:
    """base を YAML の固定値ではなく E/V/P から毎回再計算する（更新漏れ防止）。"""
    f = profile["scoring_model"]["industry_formula"]
    ind = profile["industries"][key]
    return (f["w_employment"] * ind["E"] + f["w_value_added"] * ind["V"]
            + f["w_policy"] * ind["P"]) * f["scale"]


@dataclass
class Subsidy:
    name: str
    industries: list[str] = field(default_factory=list)      # profile.industries のキー
    themes: list[str] = field(default_factory=list)          # profile.themes のキー
    uniqueness_tags: list[str] = field(default_factory=list) # profile.uniqueness_tags のキー
    generic_migration: bool = False                          # 汎用移住施策なら True（MOYAI 加点を抑止）


def score_subsidy(profile: dict, s: Subsidy, today: date | None = None) -> dict:
    today = today or date.today()
    comp = profile["scoring_model"]["score_composition"]
    notes: list[str] = []

    # 1) 産業適合: 該当産業のうち最大の base
    ind_scores = {k: industry_base(profile, k) for k in s.industries if k in profile["industries"]}
    industry_fit = max(ind_scores.values(), default=None)

    # 2) テーマ適合: 該当テーマのうち最大の P を 0〜100 に換算
    th_scores = {k: profile["themes"][k]["P"] / 5 * 100 for k in s.themes if k in profile["themes"]}
    theme_fit = max(th_scores.values(), default=None)

    # 片方しか無い場合は、もう片方の重みを寄せる
    w_i, w_t = comp["industry_fit"], comp["theme_fit"]
    if industry_fit is None and theme_fit is None:
        core = 0.0
        notes.append("産業・テーマとも未分類")
    elif industry_fit is None:
        core = (w_i + w_t) * theme_fit
    elif theme_fit is None:
        core = (w_i + w_t) * industry_fit
    else:
        core = w_i * industry_fit + w_t * theme_fit

    # 3) 固有性加点（上限あり）
    bonus = 0
    for tag in s.uniqueness_tags:
        t = profile["uniqueness_tags"].get(tag)
        if not t:
            continue
        if tag == "MOYAI" and s.generic_migration:
            notes.append("MOYAI: 汎用移住施策のため加点しない（guardrail）")
            continue
        bonus += t["bonus"]
    bonus = min(bonus, comp["uniqueness_bonus_max"])

    # 4) 時限加点（期限切れは自動失効）
    modifier = 0
    for key, m in profile["time_limited_modifiers"].items():
        if today > date.fromisoformat(m["valid_until"]):
            continue
        # テーマ（例: 防災・災害復旧）かタグで該当した補助金にだけ適用する。
        # applies_to_industries は「どの産業の補助金なら対象にするか」の絞り込み。
        hit = bool(set(s.themes) & set(m.get("applies_to_themes", []))) or key in s.uniqueness_tags
        ind_scope = set(m.get("applies_to_industries", []))
        if hit and ind_scope and s.industries and not (set(s.industries) & ind_scope):
            hit = False
        if hit:
            modifier = max(modifier, m["bonus"])
            notes.append(f"時限加点 {key}（〜{m['valid_until']}）")
    modifier = min(modifier, comp["time_limited_modifier_max"])

    total = min(100.0, core + bonus + modifier)
    return {
        "name": s.name,
        "score": round(total, 1),
        "breakdown": {
            "industry_fit": None if industry_fit is None else round(industry_fit, 1),
            "theme_fit": None if theme_fit is None else round(theme_fit, 1),
            "core": round(core, 1),
            "uniqueness_bonus": bonus,
            "time_limited_modifier": modifier,
        },
        "notes": notes,
    }


if __name__ == "__main__":
    profile = load_profile()
    samples = [
        Subsidy("介護人材確保・ICT導入補助", ["medical_welfare"], ["healthcare_workforce"]),
        Subsidy("胎児性・小児性水俣病患者等 地域生活支援事業", ["medical_welfare"],
                ["community_kyosei"], ["MINAMATA_DISEASE_AREA", "MOYAI"]),
        Subsidy("ものづくり補助金（GX枠）", ["manufacturing"], ["gaika_business", "environment_gx"],
                ["ENV_MODEL_CITY"]),
        Subsidy("被災事業者の施設復旧補助", ["construction", "tourism_sports"], ["disaster_resilience"]),
        Subsidy("移住支援金（東京圏）", [], ["migration_settlement"], ["MOYAI"], generic_migration=True),
        Subsidy("学び型ワーケーション造成支援", ["tourism_sports"], ["relationship_learning"], ["MOYAI"]),
        Subsidy("藻場造成・栽培漁業支援", ["fisheries"], ["primary_industry"]),
    ]
    for r in sorted((score_subsidy(profile, s, date(2026, 9, 11)) for s in samples),
                    key=lambda r: -r["score"]):
        print(f"{r['score']:5.1f}  {r['name']}")
        print(f"       {r['breakdown']}")
        for n in r["notes"]:
            print(f"       ※ {n}")
