<div align="center">

# 🕸️ cmd-mod-graphify

[![Licence: MIT](https://img.shields.io/badge/Licence-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![CommandCode](https://img.shields.io/badge/CommandCode-v1.7.0+-purple.svg)](https://commandcode.ai/)
[![Graphify](https://img.shields.io/badge/Graphify-v0.9.32+-emerald.svg)](https://github.com/Graphify-Labs/graphify)

**Transformez n'importe quelle base de code en un Graphe de Connaissances interrogeable dans CommandCode.**

[ Français ](README.fr.md) | [ English ](README.md)

</div>

---

## Démarrage rapide

```bash
# 1. Installer la CLI Graphify
uv tool install graphifyy

# 2. Lancer CommandCode avec le mod
cmd --mod /chemin/vers/cmd-mod-graphify/graphify.ts

# 3. Construire le graphe
/graphify
```

S'exécute 100 % en local via extraction AST. Aucune clé API LLM requise.

---

## Ce que fait ce mod

Ce mod intègre [Graphify](https://github.com/Graphify-Labs/graphify) dans [CommandCode](https://commandcode.ai). Il analyse votre code source avec Tree-sitter, construit un graphe de classes, fonctions, imports et appels, puis vous permet d'interroger, visualiser et explorer votre architecture via des commandes slash et des outils IA.

---

## Fonctionnalités

- **14 commandes slash** pour construire, interroger, tracer et visualiser le graphe
- **10 outils IA** pour que le modèle explore votre base de code de manière autonome
- **Arbres D3 et diagrammes de flux Mermaid** interactifs ouverts dans le navigateur
- **Wiki auto-généré** organisé par communautés de code
- **Détection des god-nodes** pour identifier les hubs architecturaux
- **`.graphifyignore`** avec exclusions et négation `!`
- **Enrichissement du prompt système** qui injecte le contexte du graphe à chaque échange

---

## Raccourcis de chat

Saisissez directement dans le chat sans commande slash :

- `@graph <question>` — interroge le graphe, l'IA synthétise la réponse
- `@explain <symbole>` — analyse les connexions et le rôle d'un symbole

---

## Chargement du mod

**Session ponctuelle :**
```bash
cmd --mod /chemin/vers/cmd-mod-graphify/graphify.ts
```

**Par projet (chargement automatique) :**
```bash
mkdir -p .commandcode/mods/
cp /chemin/vers/cmd-mod-graphify/graphify.ts .commandcode/mods/
```

---

## Référence des commandes

Consultez [docs/COMMANDS.md](docs/COMMANDS.md) pour la référence complète des commandes slash, outils IA, prérequis système et détails d'architecture.

---

## Contribution

Les rapports de bugs et contributions sont les bienvenus. Utilisez les modèles d'issues :

- [Signaler un bug](.github/ISSUE_TEMPLATE/bug_report.md)
- [Proposer une fonctionnalité](.github/ISSUE_TEMPLATE/feature_request.md)

---

## Licence

Licence MIT. Mod communautaire indépendant, non affilié à Graphify-Labs ou Langbase, Inc.
