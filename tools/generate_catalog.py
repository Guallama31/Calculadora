#!/usr/bin/env python3
"""Genera data/catalog.js a partir de los dumps públicos de ao-bin-dumps.

Uso:
    python3 tools/generate_catalog.py                      # descarga los dumps desde la API de GitHub
    python3 tools/generate_catalog.py --full /tmp/items.json --index /tmp/formatted_items.json

Fuentes (datos del juego, propiedad de Sandbox Interactive):
    https://github.com/ao-data/ao-bin-dumps/blob/master/items.json
    https://github.com/ao-data/ao-bin-dumps/blob/master/formatted/items.json

Salida: un módulo ES con el catálogo (sin fetch()):

    export const CATALOG = [ ... ];

Esquema de cada entrada:
    id      ID de mercado (T5_2H_BOW@1)
    base    ID base sin encantamiento
    lvl     nivel de encantamiento 0-4
    tier    2-8
    es/en   nombres localizados (+ sufijo " .N" si está encantado)
    cat/sub categoría y subcategoría de tienda
    value   item value (suma de los valores de los materiales); base de la nutrición
    amount  unidades producidas por crafteo
    res[]   {id, es, q, ret=false?, max=?}  (si falta "ret" se asume retornable)
    journal {type, empty, full, emptyEs, fullEs, fame, max} | null
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.request

REPO = "ao-data/ao-bin-dumps"
REF = "master"
FULL_PATH = "items.json"
INDEX_PATH = "formatted/items.json"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "catalog.js")

FAME_FACTOR = {(2, 0): 1.5, (3, 0): 7.5}
for _t, _base in [(4, 22.5), (5, 90), (6, 270), (7, 645), (8, 1395)]:
    for _l in range(5):
        FAME_FACTOR[(_t, _l)] = _base * (2 ** _l)

MAX_FAME = {2: 900, 3: 1800, 4: 3600, 5: 7200, 6: 14400, 7: 28380, 8: 58590}

JOURNAL_TYPE = {
    "tools": "TOOLMAKER", "gatherergear": "TOOLMAKER", "trackingtool": "TOOLMAKER",
    "cloth_helmet": "MAGE", "cloth_armor": "MAGE", "cloth_shoes": "MAGE",
    "cursestaff": "MAGE", "firestaff": "MAGE", "froststaff": "MAGE",
    "arcanestaff": "MAGE", "holystaff": "MAGE",
    "plate_helmet": "WARRIOR", "plate_armor": "WARRIOR", "plate_shoes": "WARRIOR",
    "crossbow": "WARRIOR", "axe": "WARRIOR", "sword": "WARRIOR",
    "hammer": "WARRIOR", "mace": "WARRIOR", "knuckles": "WARRIOR",
    "leather_helmet": "HUNTER", "leather_armor": "HUNTER", "leather_shoes": "HUNTER",
    "bow": "HUNTER", "naturestaff": "HUNTER", "dagger": "HUNTER",
    "spear": "HUNTER", "quarterstaff": "HUNTER", "shapeshifterstaff": "HUNTER",
}


def as_list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def num(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def gh_api(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Calculadora-Catalog-Generator"})
    with urllib.request.urlopen(req, timeout=180) as response:
        return json.load(response)


def download_dump(path, dest):
    meta = gh_api(f"https://api.github.com/repos/{REPO}/contents/{path}?ref={REF}")
    blob = gh_api(f"https://api.github.com/repos/{REPO}/git/blobs/{meta['sha']}")
    raw = base64.b64decode(blob["content"])
    with open(dest, "wb") as handle:
        handle.write(raw)
    print(f"  {path}: {len(raw) / 1024 / 1024:.1f} MB")
    return dest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--full", help="ruta local a items.json (dump completo)")
    parser.add_argument("--index", help="ruta local a formatted/items.json (nombres)")
    args = parser.parse_args()

    if args.full and args.index:
        full_path, index_path = args.full, args.index
    else:
        print("Descargando dumps de ao-bin-dumps…")
        tmp = "/tmp/ao-catalog-dumps"
        os.makedirs(tmp, exist_ok=True)
        full_path = args.full or download_dump(FULL_PATH, os.path.join(tmp, "items.json"))
        index_path = args.index or download_dump(INDEX_PATH, os.path.join(tmp, "formatted_items.json"))

    full = json.load(open(full_path, encoding="utf-8"))["items"]
    indexed = json.load(open(index_path, encoding="utf-8"))
    names = {x["UniqueName"]: (x.get("LocalizedNames") or {}) for x in indexed}

    details = {}
    for _kind, group in full.items():
        if isinstance(group, list):
            for item in group:
                uid = item.get("@uniquename")
                if uid:
                    details[uid] = (_kind, item)

    value_cache = {}

    def strip_at(uid):
        return uid.split("@")[0]

    def item_value(uid, depth=0):
        uid = strip_at(uid)
        if uid in value_cache:
            return value_cache[uid]
        entry = details.get(uid)
        if not entry or depth > 4:
            return 0.0
        data = entry[1]
        if data.get("@itemvalue") is not None:
            result = num(data["@itemvalue"])
            value_cache[uid] = result
            return result
        requirements = as_list(data.get("craftingrequirements"))
        result = 0.0
        if requirements:
            for resource in as_list(requirements[0].get("craftresource")):
                if isinstance(resource, dict):
                    result += item_value(resource.get("@uniquename", ""), depth + 1) * num(resource.get("@count"))
        value_cache[uid] = result
        return result

    def localized(uid, lang):
        entry = names.get(uid, {})
        return entry.get(lang) or entry.get("ES-ES") or entry.get("EN-US") or uid

    def market_id(resource_id, level):
        """El dump usa T5_PLANKS_LEVEL1; el mercado usa T5_PLANKS_LEVEL1@1."""
        if level <= 0 or "@" in resource_id:
            return resource_id
        candidate = f"{resource_id}@{level}"
        if candidate in names:
            return candidate
        candidate = f"{resource_id}_LEVEL{level}@{level}"
        if candidate in names:
            return candidate
        return f"{resource_id}@{level}"

    def journal_type(uid, crafting_category):
        if "_CAPE" in uid or "_BAG" in uid:
            return "TOOLMAKER"
        if crafting_category in ("offhand", ""):
            if any(k in uid for k in ("OFF_SCHIELD", "OFF_TOWERSHIELD", "OFF_SPIKEDSHIELD")):
                return "WARRIOR"
            if any(k in uid for k in ("OFF_JESTERCANE", "OFF_TORCH", "OFF_LAMP", "OFF_TALISMAN", "OFF_HORN")):
                return "HUNTER"
            if any(k in uid for k in ("OFF_CENSER", "OFF_TOTEM", "OFF_DEMONSKULL", "OFF_ORB", "OFF_BOOK")):
                return "MAGE"
        return JOURNAL_TYPE.get(crafting_category)

    def upgrade_at(data, level):
        """Materiales para subir de (level-1) a level: runas/almas/reliquias."""
        if level <= 0 or level > 3:
            return None
        enchantments = data.get("enchantments")
        group = as_list(enchantments.get("enchantment") if isinstance(enchantments, dict) else None)
        match = next((x for x in group if num(x.get("@enchantmentlevel")) == level), None)
        if not match:
            return None
        requirements = match.get("upgraderequirements")
        resources = as_list(requirements.get("upgraderesource") if isinstance(requirements, dict) else None)
        if not resources or not isinstance(resources[0], dict):
            return None
        raw = resources[0]
        rid = raw.get("@uniquename")
        quantity = int(num(raw.get("@count")))
        if not rid or quantity <= 0:
            return None
        return {"id": rid, "es": localized(rid, "ES-ES"), "q": quantity}

    def recipe_at(data, level):
        if level == 0:
            requirements = as_list(data.get("craftingrequirements"))
        else:
            enchantments = data.get("enchantments")
            group = as_list(enchantments.get("enchantment") if isinstance(enchantments, dict) else None)
            match = next((x for x in group if num(x.get("@enchantmentlevel")) == level), None)
            if not match:
                return None
            requirements = as_list(match.get("craftingrequirements"))
        for requirement in requirements:
            if not isinstance(requirement, dict):
                continue
            resources = as_list(requirement.get("craftresource"))
            if resources and not any(
                "FACTION_" in (r.get("@uniquename") or "")
                for r in resources if isinstance(r, dict)
            ):
                return requirement, resources
        return None

    catalog = []
    for uid, (kind, data) in details.items():
        match = re.match(r"^T([2-8])_", uid)
        if not match or "_LEVEL" in uid or "@" in uid:
            continue
        tier = int(match.group(1))
        crafting_category = (data.get("@craftingcategory") or "").lower()

        for level in range(5):
            recipe = recipe_at(data, level)
            if not recipe:
                continue
            requirement, raw_resources = recipe
            market_name = uid if level == 0 else f"{uid}@{level}"
            if level > 0 and market_name not in names:
                continue

            resources = []
            material_count = 0
            for raw in raw_resources:
                if not isinstance(raw, dict):
                    continue
                resource_id = raw.get("@uniquename")
                quantity = int(num(raw.get("@count")))
                if not resource_id or quantity <= 0:
                    continue
                resource_level = level if num(raw.get("@enchantmentlevel")) > 0 else 0
                rid = market_id(resource_id, resource_level)
                max_return = raw.get("@maxreturnamount")
                returnable = True if max_return is None else num(max_return) > 0
                entry = {"id": rid, "es": localized(rid, "ES-ES"), "q": quantity}
                if not returnable:
                    entry["ret"] = False
                elif max_return is not None and num(max_return) > 0:
                    entry["max"] = num(max_return)
                resources.append(entry)
                upper = resource_id.upper()
                if not any(k in upper for k in ("_ARTEFACT_", "_FAVOR_", "_ALCHEMY_")):
                    material_count += quantity
            if not resources:
                continue

            value = sum(item_value(r["id"]) * r["q"] for r in resources)
            journal = None
            if kind in ("weapon", "equipmentitem", "transformationweapon", "trackingitem"):
                jtype = journal_type(uid, crafting_category)
                if jtype and tier in MAX_FAME:
                    empty = f"T{tier}_JOURNAL_{jtype}_EMPTY"
                    filled = f"T{tier}_JOURNAL_{jtype}_FULL"
                    if empty in names and filled in names:
                        journal = {
                            "type": jtype,
                            "empty": empty,
                            "full": filled,
                            "emptyEs": localized(empty, "ES-ES"),
                            "fullEs": localized(filled, "ES-ES"),
                            "fame": material_count * FAME_FACTOR.get((tier, level), 0),
                            "max": MAX_FAME[tier],
                        }

            suffix = f" .{level}" if level else ""
            catalog.append({
                "id": market_name,
                "base": uid,
                "lvl": level,
                "tier": tier,
                "es": localized(market_name, "ES-ES") + suffix,
                "en": localized(market_name, "EN-US") + suffix,
                "cat": data.get("@shopcategory") or "",
                "sub": data.get("@shopsubcategory1") or "",
                "ccat": crafting_category,
                "refine": crafting_category in ("wood", "ore", "hide", "fiber", "rock") and
                          (data.get("@shopcategory") or "") == "crafting",
                "value": round(value, 2),
                "amount": int(num(requirement.get("@amountcrafted"), 1)) or 1,
                "res": resources,
                "upgrade": upgrade_at(data, level),
                "journal": journal,
            })

    catalog.sort(key=lambda x: (x["base"], x["lvl"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write("/* Generado por tools/generate_catalog.py desde ao-bin-dumps. No editar a mano. */\n")
        handle.write("export const CATALOG = ")
        json.dump(catalog, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write(";\n")
    print(f"Listo: {len(catalog)} recetas → {OUT} ({os.path.getsize(OUT) / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
