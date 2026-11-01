"""
Peuple la base locale avec le catalogue de l'entreprise
(extrait de donnee BD devis.docx — données uniquement, pas le code Prisma).
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

EXTRACT = ROOT / "scripts" / "_donnee_extract.txt"
UNITS = {"M2", "ML", "PIECE", "JOUR", "HEURE", "LITRE", "KG", "FORFAIT"}


class JSParser:
    def __init__(self, src: str):
        self.s = src
        self.i = 0
        self.n = len(src)

    def peek(self) -> str:
        return self.s[self.i] if self.i < self.n else ""

    def skip(self) -> None:
        while self.i < self.n:
            if self.s[self.i] in " \t\r\n":
                self.i += 1
                continue
            if self.s.startswith("//", self.i):
                while self.i < self.n and self.s[self.i] not in "\n":
                    self.i += 1
                continue
            break

    def parse_value(self):
        self.skip()
        c = self.peek()
        if c == "{":
            return self.parse_object()
        if c == "[":
            return self.parse_array()
        if c in "'\"":
            return self.parse_string()
        if c == "-" or c.isdigit():
            return self.parse_number()
        if self.s.startswith("true", self.i):
            self.i += 4
            return True
        if self.s.startswith("false", self.i):
            self.i += 5
            return False
        if self.s.startswith("null", self.i):
            self.i += 4
            return None
        raise ValueError(f"Valeur inattendue à {self.i}: {self.s[self.i:self.i+40]!r}")

    def parse_string(self) -> str:
        quote = self.s[self.i]
        self.i += 1
        out = []
        while self.i < self.n:
            ch = self.s[self.i]
            if ch == "\\" and self.i + 1 < self.n:
                nxt = self.s[self.i + 1]
                out.append({"n": "\n", "t": "\t", "'": "'", '"': '"', "\\": "\\"}.get(nxt, nxt))
                self.i += 2
                continue
            if ch == quote:
                self.i += 1
                return "".join(out)
            out.append(ch)
            self.i += 1
        raise ValueError("Chaîne non terminée")

    def parse_number(self):
        m = re.match(r"-?\d+(?:\.\d+)?", self.s[self.i :])
        if not m:
            raise ValueError("Nombre invalide")
        tok = m.group(0)
        self.i += len(tok)
        return float(tok) if "." in tok else int(tok)

    def parse_ident(self) -> str:
        m = re.match(r"[A-Za-z_À-ÿ][\wÀ-ÿ]*", self.s[self.i :])
        if not m:
            raise ValueError(f"Identifiant attendu à {self.i}")
        self.i += len(m.group(0))
        return m.group(0)

    def parse_key(self) -> str:
        self.skip()
        if self.peek() in "'\"":
            return self.parse_string()
        return self.parse_ident()

    def parse_object(self) -> dict:
        self.i += 1
        obj = {}
        while True:
            self.skip()
            if self.peek() == "}":
                self.i += 1
                return obj
            key = self.parse_key()
            self.skip()
            if self.peek() != ":":
                raise ValueError(f"':' attendu après {key!r} à {self.i}")
            self.i += 1
            obj[key] = self.parse_value()
            self.skip()
            if self.peek() == ",":
                self.i += 1
                continue
            if self.peek() == "}":
                self.i += 1
                return obj
            raise ValueError(f"',' ou '}}' attendu à {self.i}: {self.s[self.i:self.i+30]!r}")

    def parse_array(self) -> list:
        self.i += 1
        arr = []
        while True:
            self.skip()
            if self.peek() == "]":
                self.i += 1
                return arr
            arr.append(self.parse_value())
            self.skip()
            if self.peek() == ",":
                self.i += 1
                continue
            if self.peek() == "]":
                self.i += 1
                return arr
            raise ValueError(f"',' ou ']' attendu à {self.i}: {self.s[self.i:self.i+30]!r}")


def slice_const_array(src: str, name: str) -> str:
    token = f"const {name}"
    start = src.find(token)
    if start < 0:
        raise SystemExit(f"Bloc introuvable : {name}")
    eq = src.find("=", start)
    if eq < 0:
        raise SystemExit(f"Affectation introuvable : {name}")
    i = src.find("[", eq)
    parser = JSParser(src[i:])
    parser.parse_array()
    return src[i : i + parser.i]


def slice_const_object(src: str, name: str) -> str:
    token = f"const {name}"
    start = src.find(token)
    if start < 0:
        raise SystemExit(f"Bloc introuvable : {name}")
    i = src.find("{", start)
    # skip TypeScript generic `{ choix: string; ... }[] = [`  OR Record = {
    rest = src[start:]
    eq = rest.find("=")
    body = rest[eq + 1 :]
    parser = JSParser(body)
    parser.skip()
    val = parser.parse_value()
    return val


def parse_array_named(src: str, name: str):
    raw = slice_const_array(src, name)
    return JSParser(raw).parse_array()


def normalize_choix(choix):
    out = []
    if not choix:
        return out
    for item in choix:
        if isinstance(item, str):
            out.append({"nom": item, "impactPrix": 0})
        elif isinstance(item, dict):
            out.append({"nom": item["nom"], "impactPrix": item.get("impactPrix") or 0})
    return out


def unit(val: str) -> str:
    u = str(val or "M2").upper()
    return u if u in UNITS else "M2"


def truncate_catalogue(cur) -> None:
    cur.execute(
        """
        TRUNCATE TABLE
          choix_options_compositions,
          prestations_compositions,
          choix_options,
          options_prestations,
          lignes_devis,
          versions_devis,
          devis,
          prestations,
          categories_prestations,
          materiaux,
          services_main_oeuvre,
          clients,
          companies
        RESTART IDENTITY CASCADE
        """
    )


def main() -> None:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("DATABASE_URL manquante dans .env")
    src = EXTRACT.read_text(encoding="utf-8")

    catalogue = parse_array_named(src, "catalogue")
    materiaux = parse_array_named(src, "materiauxData")
    services = parse_array_named(src, "servicesMoData")
    compositions = parse_array_named(src, "compositionsData")

    option_comp_specs = [
        ("chapeChoixCompositions", "Chape béton", "Type de chape", True),
        ("montageCloisonCompositions", "Montage cloison placo", "Type de placo", False),
        ("isolMurCompositions", "Isolation mur intérieur", "Type d'isolant", False),
        ("carrelageCompositions", "Pose carrelage sol", "Format", False),
        ("carrelageMuralCompositions", "Pose carrelage mural", "Format", False),
        ("faienceTypeCompositions", "Pose faïence", "Type", False),
        ("ragrageTypeCompositions", "Ragréage sol", "Type de ragréage", False),
    ]
    option_comps = []
    for name, prest, opt, is_list in option_comp_specs:
        val = slice_const_object(src, name)
        if is_list:
            rows = val
        else:
            rows = list(val.values()) if isinstance(val, dict) else val
        option_comps.append((prest, opt, rows))

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()
    truncate_catalogue(cur)

    cur.execute(
        """
        INSERT INTO companies (nom, email, "tvaDefaut", devise, "createdAt", "updatedAt")
        VALUES (%s, %s, 20, 'EUR', now(), now())
        RETURNING id
        """,
        ("Bâtiment Pro", "admin@batiment-pro.fr"),
    )
    company_id = cur.fetchone()[0]
    cur.execute(
        """
        INSERT INTO clients ("companyId", nom, prenom, email, source, "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, 'AUTRE', now(), now())
        """,
        (company_id, "Dupont", "Jean-Paul", "jean.dupont@example.com"),
    )

    cat_ids: dict[str, int] = {}
    for bloc in catalogue:
        cat_nom = bloc["categorie"]
        cur.execute(
            """
            INSERT INTO categories_prestations ("companyId", nom, description, actif, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, true, now(), now())
            RETURNING id
            """,
            (company_id, cat_nom, bloc.get("description")),
        )
        cat_ids[cat_nom] = cur.fetchone()[0]

        for sc in bloc.get("sousCategories") or []:
            for p in sc.get("prestations") or []:
                cur.execute(
                    """
                    INSERT INTO prestations (
                      "companyId", "categorieId", nom, unite,
                      "prixVenteMin", "prixVenteMax", description, actif, "createdAt", "updatedAt"
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, true, now(), now())
                    RETURNING id
                    """,
                    (
                        company_id,
                        cat_ids[cat_nom],
                        p["nom"],
                        unit(p.get("unite")),
                        p["prixVenteMin"],
                        p["prixVenteMax"],
                        p.get("description"),
                    ),
                )
                prest_id = cur.fetchone()[0]
                for ordre, opt in enumerate(p.get("options") or []):
                    cur.execute(
                        """
                        INSERT INTO options_prestations (
                          "prestationId", nom, obligatoire, ordre, "createdAt", "updatedAt"
                        ) VALUES (%s, %s, %s, %s, now(), now())
                        RETURNING id
                        """,
                        (prest_id, opt["nom"], bool(opt.get("obligatoire")), ordre),
                    )
                    opt_id = cur.fetchone()[0]
                    for c_ordre, ch in enumerate(normalize_choix(opt.get("choix"))):
                        cur.execute(
                            """
                            INSERT INTO choix_options (
                              "optionId", nom, "impactPrix", ordre, actif, "createdAt", "updatedAt"
                            ) VALUES (%s, %s, %s, %s, true, now(), now())
                            """,
                            (opt_id, ch["nom"], ch["impactPrix"], c_ordre),
                        )

    mat_ids: dict[str, int] = {}
    for m in materiaux:
        cur.execute(
            """
            INSERT INTO materiaux (
              "companyId", nom, couleur, finition, unite, "prixAchatFixe",
              actif, "createdAt", "updatedAt"
            ) VALUES (%s, %s, %s, %s, %s, %s, true, now(), now())
            RETURNING id
            """,
            (
                company_id,
                m["nom"],
                m.get("couleur"),
                m.get("finition"),
                unit(m.get("unite")),
                m["prixAchatFixe"],
            ),
        )
        mat_ids[m["nom"]] = cur.fetchone()[0]

    svc_ids: dict[str, int] = {}
    for s in services:
        cur.execute(
            """
            INSERT INTO services_main_oeuvre (
              "companyId", nom, unite, "prixUnitaire", "productiviteJour", "coutJournalier",
              actif, "createdAt", "updatedAt"
            ) VALUES (%s, %s, %s, %s, %s, %s, true, now(), now())
            RETURNING id
            """,
            (
                company_id,
                s["nom"],
                unit(s.get("unite")),
                s["prixUnitaire"],
                s.get("productiviteJour"),
                s.get("coutJournalier"),
            ),
        )
        svc_ids[s["nom"]] = cur.fetchone()[0]

    def prest_id_by_name(nom: str) -> int | None:
        cur.execute(
            'SELECT id FROM prestations WHERE "companyId" = %s AND nom = %s',
            (company_id, nom),
        )
        row = cur.fetchone()
        return row[0] if row else None

    missing_comp = []
    for row in compositions:
        pid = prest_id_by_name(row["prestation"])
        if pid is None:
            missing_comp.append(row["prestation"])
            continue
        for c in row["composants"]:
            mid = mat_ids.get(c["materiau"]) if c.get("materiau") else None
            sid = svc_ids.get(c["serviceMo"]) if c.get("serviceMo") else None
            if mid is None and sid is None:
                missing_comp.append(f"{row['prestation']} / {c}")
                continue
            cur.execute(
                """
                INSERT INTO prestations_compositions
                  ("prestationId", "materiauId", "serviceMainOeuvreId", "quantiteParUnite")
                VALUES (%s, %s, %s, %s)
                """,
                (pid, mid, sid, c["qte"]),
            )

    missing_opt = []
    for prest_nom, opt_nom, rows in option_comps:
        pid = prest_id_by_name(prest_nom)
        if pid is None:
            missing_opt.append(f"prestation {prest_nom}")
            continue
        cur.execute(
            """
            SELECT id FROM options_prestations
            WHERE "prestationId" = %s AND nom = %s
            """,
            (pid, opt_nom),
        )
        opt_row = cur.fetchone()
        if not opt_row:
            missing_opt.append(f"option {opt_nom} / {prest_nom}")
            continue
        opt_id = opt_row[0]
        for defn in rows:
            choix_nom = defn["choix"] if isinstance(defn, dict) else defn
            composants = defn.get("composants", []) if isinstance(defn, dict) else []
            cur.execute(
                """
                SELECT id FROM choix_options
                WHERE "optionId" = %s AND nom = %s
                """,
                (opt_id, choix_nom),
            )
            ch = cur.fetchone()
            if not ch:
                missing_opt.append(f"choix {choix_nom} / {prest_nom}")
                continue
            for c in composants:
                mid = mat_ids.get(c["materiau"]) if c.get("materiau") else None
                sid = svc_ids.get(c["serviceMo"]) if c.get("serviceMo") else None
                if mid is None and sid is None:
                    continue
                cur.execute(
                    """
                    INSERT INTO choix_options_compositions
                      ("choixOptionId", "materiauId", "serviceMainOeuvreId", "quantiteParUnite")
                    VALUES (%s, %s, %s, %s)
                    """,
                    (ch[0], mid, sid, c["qte"]),
                )

    conn.commit()
    cur.execute("SELECT count(*) FROM prestations")
    n_p = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM materiaux")
    n_m = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM services_main_oeuvre")
    n_s = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM options_prestations")
    n_o = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM choix_options")
    n_c = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM prestations_compositions")
    n_pc = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM choix_options_compositions")
    n_cc = cur.fetchone()[0]
    cur.close()
    conn.close()

    print(f"OK — company_id={company_id}")
    print(f"  prestations={n_p}  materiaux={n_m}  services={n_s}")
    print(f"  options={n_o}  choix={n_c}")
    print(f"  compositions prestation={n_pc}  compositions choix={n_cc}")
    if missing_comp:
        print("Compositions sans correspondance :", ", ".join(sorted(set(missing_comp))[:20]))
    if missing_opt:
        print("Compositions d'options sans correspondance :", ", ".join(sorted(set(missing_opt))[:20]))


if __name__ == "__main__":
    main()
