#!/usr/bin/env python3
"""Genera data/catalog.js a partir de los dumps públicos de ao-bin-dumps.

Uso:
    python3 tools/generate_catalog.py                      # descarga los dumps del commit fijado en REF
    python3 tools/generate_catalog.py --ref <sha>          # usa otro commit de ao-bin-dumps
    python3 tools/generate_catalog.py --full /tmp/items.json --index /tmp/formatted_items.json
    python3 tools/generate_catalog.py --out /tmp/catalog.js   # escribe en otra ruta

Fuentes (datos del juego, propiedad de Sandbox Interactive):
    https://github.com/ao-data/ao-bin-dumps/blob/master/items.json
    https://github.com/ao-data/ao-bin-dumps/blob/master/formatted/items.json

Salida: un módulo ES con el catálogo (sin fetch()):

    export const CATALOG = [ ... ];

Esquema de cada entrada:
    id      ID de mercado (T5_2H_BOW@1, T4_PLANKS_LEVEL1@1)
    base    ID base sin encantamiento (las variantes refinadas comparten el ID base)
    lvl     nivel de encantamiento 0-4
    tier    2-8
    es/en   nombres localizados (+ sufijo " .N" si está encantado)
    cat/sub/sub2 categorías originales de tienda; categoryId se deriva al cargar el catálogo
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
import tempfile
import urllib.request

REPO = "ao-data/ao-bin-dumps"
# Commit del dump con el que se generó data/catalog.js. Un REF móvil (por ejemplo
# "master") hacía que dos regeneraciones del mismo día produjeran catálogos
# distintos sin dejar rastro: fijarlo hace el resultado reproducible.
# Al actualizar el catálogo hay que cambiar el SHA y volver a ejecutar este script.
REF = "0483dd97f1581dfaf02eed42f25f5ea2a3cb75e5"
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
    global REF
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--full", help="ruta local a items.json (dump completo)")
    parser.add_argument("--index", help="ruta local a formatted/items.json (nombres)")
    parser.add_argument("--ref", default=REF, help=f"commit de {REPO} (por defecto {REF})")
    parser.add_argument("--out", default=OUT, help="ruta del catálogo generado")
    args = parser.parse_args()
    REF = args.ref

    if args.full and args.index:
        full_path, index_path = args.full, args.index
    else:
        print("Descargando dumps de ao-bin-dumps...")
        tmp = os.path.join(tempfile.gettempdir(), "ao-catalog-dumps")
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

    def untranslated(*uids):
        """True si el dump no trae nombre en español.

        Los mapas de mazmorra (T*_RANDOM_DUNGEON_*_TOKEN*) y algunas monturas
        de evento no existen en formatted/items.json o no tienen
        <LocalizedNames>, así que su nombre visible es el propio ID. Se marca
        la entrada para que la interfaz lo indique en vez de fingir un nombre.
        """
        return any(uid and not names.get(uid, {}).get("ES-ES") for uid in uids)

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

    def recipe_at(data, level, faction_recipe=False):
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
            has_faction_resource = any(
                "FACTION_" in (r.get("@uniquename") or "")
                for r in resources if isinstance(r, dict)
            )
            if resources and has_faction_resource == faction_recipe:
                return requirement, resources
        return None

    def normalize_resources(raw_resources, level):
        resources = []
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
        return resources

    catalog = []
    for uid, (kind, data) in details.items():
        match = re.match(r"^T([2-8])_", uid)
        if not match or "@" in uid:
            continue
        tier = int(match.group(1))
        crafting_category = (data.get("@craftingcategory") or "").lower()
        refined_match = re.match(r"^(T[2-8]_.+)_LEVEL([1-4])$", uid)
        is_enchanted_refined_material = (
            refined_match is not None
            and (data.get("@shopcategory") or "") == "crafting"
            and (data.get("@shopsubcategory1") or "").lower() == "refinedresources"
        )
        if "_LEVEL" in uid and not is_enchanted_refined_material:
            continue

        is_refining = crafting_category in ("wood", "ore", "hide", "fiber", "rock") and \
                      (data.get("@shopcategory") or "") == "crafting"
        levels = [int(refined_match.group(2))] if is_enchanted_refined_material else range(5)
        for level in levels:
            recipe = recipe_at(data, 0 if is_enchanted_refined_material else level)
            if not recipe:
                continue
            requirement, raw_resources = recipe
            base_id = refined_match.group(1) if is_enchanted_refined_material else uid
            market_name = f"{uid}@{level}" if is_enchanted_refined_material else (
                uid if level == 0 else f"{uid}@{level}"
            )
            if level > 0 and not is_enchanted_refined_material and market_name not in names:
                continue

            resources = normalize_resources(raw_resources, level)
            alternate_recipe = recipe_at(data, 0 if is_enchanted_refined_material else level,
                                         faction_recipe=True) if is_refining else None
            alternate_resources = normalize_resources(alternate_recipe[1], level) if alternate_recipe else []
            material_count = 0
            for raw in raw_resources:
                if not isinstance(raw, dict):
                    continue
                resource_id = raw.get("@uniquename")
                quantity = int(num(raw.get("@count")))
                if not resource_id or quantity <= 0:
                    continue
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
                "base": base_id,
                "lvl": level,
                "tier": tier,
                "es": localized(base_id, "ES-ES") + suffix,
                "en": localized(base_id, "EN-US") + suffix,
                "cat": data.get("@shopcategory") or "",
                "sub": data.get("@shopsubcategory1") or "",
                "sub2": data.get("@shopsubcategory2") or "",
                "ccat": crafting_category,
                "refine": is_refining,
                "value": round(value, 2),
                "amount": int(num(requirement.get("@amountcrafted"), 1)) or 1,
                "res": resources,
                **({"alternateRes": alternate_resources} if alternate_resources else {}),
                "upgrade": upgrade_at(data, level),
                "journal": journal,
                **({"untranslated": True} if untranslated(base_id) else {}),
            })

    catalog.sort(key=lambda x: (x["base"], x["lvl"]))

    mount_grown_ids = {
        resource["id"]
        for item in catalog
        if item["cat"] == "mounts"
        for resource in item["res"]
        if resource["id"] in details
    }
    mount_breeding = []
    accepted_food_categories = set()
    for uid, (kind, data) in details.items():
        grown_item = data.get("grownitem")
        grown_id = grown_item.get("@uniquename") if isinstance(grown_item, dict) else None
        if kind != "farmableitem" or grown_id not in mount_grown_ids:
            continue
        food = data.get("consumption", {}).get("food", {})
        accepted_food = as_list(food.get("acceptedfood") if isinstance(food, dict) else None)
        accepted_food_entries = [
            entry for entry in accepted_food if isinstance(entry, dict)
        ]
        food_categories = sorted({
            entry.get("@foodcategory")
            for entry in accepted_food_entries if entry.get("@foodcategory")
        })
        favorite_food_id = next(
            (entry.get("@favorite") for entry in accepted_food_entries if entry.get("@favorite")),
            None,
        )
        accepted_food_categories.update(food_categories)
        offspring = grown_item.get("offspring", {})
        requirements = data.get("craftingrequirements", {})
        mount_breeding.append({
            "id": uid,
            "es": localized(uid, "ES-ES"),
            "tier": int(num(data.get("@tier"))),
            "plot": data.get("@shopsubcategory1") or "",
            "type": data.get("@shopsubcategory3") or "",
            "grownId": grown_id,
            "grownEs": localized(grown_id, "ES-ES"),
            "growTime": num(grown_item.get("@growtime")),
            "offspringChance": num(offspring.get("@chance")),
            "offspringAmount": num(offspring.get("@amount")),
            "silverCost": num(requirements.get("@silver")) if isinstance(requirements, dict) else 0,
            "nutritionMax": num(food.get("@nutritionmax")) if isinstance(food, dict) else 0,
            "secondsPerNutrition": num(food.get("@secondspernutrition")) if isinstance(food, dict) else 0,
            "lossBeforeHungry": num(food.get("@lossbeforehungry")) if isinstance(food, dict) else 0,
            "focusCost": num(data.get("@activefarmfocuscost")),
            "focusBonus": num(data.get("@activefarmbonus")),
            "focusMaxCycles": num(data.get("@activefarmmaxcycles")),
            "foodCategories": food_categories,
            "favoriteFoodId": favorite_food_id,
            "favoriteFoodEs": localized(favorite_food_id, "ES-ES") if favorite_food_id else None,
            "favoriteFoodBonus": next(
                (num(entry.get("@favoritebonus")) for entry in accepted_food_entries
                 if entry.get("@favorite")),
                0,
            ),
            **(({"untranslated": True} if untranslated(uid, grown_id, favorite_food_id) else {})),
        })
    mount_breeding.sort(key=lambda item: (item["tier"], item["es"]))

    mount_foods = []
    for uid, (_kind, data) in details.items():
        nutrition = num(data.get("@nutrition"))
        food_category = data.get("@foodcategory")
        if nutrition <= 0 or food_category not in accepted_food_categories:
            continue
        mount_foods.append({
            "id": uid,
            "es": localized(uid, "ES-ES"),
            "tier": int(num(data.get("@tier"))),
            "nutrition": nutrition,
            "category": food_category,
            **({"untranslated": True} if untranslated(uid) else {}),
        })
    mount_foods.sort(key=lambda item: (item["tier"], item["es"], item["id"]))

    if not mount_breeding or not mount_foods:
        raise ValueError("No se pudieron generar los datos de crianza de monturas.")

    out_path = args.out
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        handle.write(
            f"/* Generado por tools/generate_catalog.py desde {REPO}@{REF}. "
            "No editar a mano. */\n"
        )
        handle.write("export const CATALOG = ")
        json.dump(catalog, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write(";\nexport const MOUNT_BREEDING = ")
        json.dump(mount_breeding, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write(";\nexport const MOUNT_FOODS = ")
        json.dump(mount_foods, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write(";\n")
    sin_nombre = sum(1 for item in catalog if item.get("untranslated"))
    print(f"Listo: {len(catalog)} recetas, {len(mount_breeding)} animales y "
          f"{len(mount_foods)} alimentos -> {out_path} "
          f"({os.path.getsize(out_path) / 1024 / 1024:.2f} MB) desde {REF}")
    print(f"  {sin_nombre} entradas sin nombre en el dump (marcadas como untranslated)")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
