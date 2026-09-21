#!/usr/bin/env bash
# Installs ai-powers skills and commands into the global agent directories.
#
# This repo is installed by this script ONLY. Do not also add it with
# `npx skills`: the forked skills keep upstream names, so `npx skills update`
# would re-fetch the upstream copies and clobber ours.
set -euo pipefail

SKILLS_DIR="${HOME}/.agents/skills"
COMMANDS_DIR="${HOME}/.config/opencode/commands"
FROM_GIT=""
REF=""
CACHE_DIR="${HOME}/.local/share/ai-powers"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skills-dir) SKILLS_DIR="$2"; shift 2 ;;
    --commands-dir) COMMANDS_DIR="$2"; shift 2 ;;
    --from-git) FROM_GIT="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --cache-dir) CACHE_DIR="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -n "${FROM_GIT}" ]]; then
  if [[ -d "${CACHE_DIR}/.git" ]]; then
    echo "updating cache: ${CACHE_DIR}"
    git -C "${CACHE_DIR}" fetch --depth 1 origin
  else
    echo "cloning ${FROM_GIT} -> ${CACHE_DIR}"
    mkdir -p "$(dirname "${CACHE_DIR}")"
    git clone --depth 1 "https://github.com/${FROM_GIT}.git" "${CACHE_DIR}"
  fi
  target="${REF:-origin/HEAD}"
  git -C "${CACHE_DIR}" checkout --detach --force "${target}"
  root="${CACHE_DIR}"
else
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

src_skills="${root}/skills"
src_commands="${root}/commands"

[[ -d "${src_skills}" ]] || { echo "skills not found at ${src_skills}" >&2; exit 1; }
[[ -d "${src_commands}" ]] || { echo "commands not found at ${src_commands}" >&2; exit 1; }

mkdir -p "${SKILLS_DIR}" "${COMMANDS_DIR}"

skill_count=0
for skill in "${src_skills}"/*/; do
  [[ -f "${skill}/SKILL.md" ]] || continue
  name="$(basename "${skill}")"
  rm -rf "${SKILLS_DIR:?}/${name}"
  cp -R "${skill}" "${SKILLS_DIR}/${name}"
  echo "installed skill:   ${name}"
  skill_count=$((skill_count + 1))
done

command_count=0
shipped=()
for file in "${src_commands}"/*.md; do
  [[ -e "${file}" ]] || continue
  cp -f "${file}" "${COMMANDS_DIR}/$(basename "${file}")"
  echo "installed command: $(basename "${file}")"
  shipped+=("$(basename "${file}")")
  command_count=$((command_count + 1))
done

# Prune commands this repo no longer ships locally, so a renamed or relocated
# command does not linger. Only touches files matching the he9_ prefix.
for existing in "${COMMANDS_DIR}"/he9_*.md; do
  [[ -e "${existing}" ]] || continue
  name="$(basename "${existing}")"
  keep=0
  for s in "${shipped[@]}"; do [[ "${s}" == "${name}" ]] && keep=1; done
  if [[ "${keep}" -eq 0 ]]; then
    rm -f "${existing}"
    echo "removed stale command: ${name}"
  fi
done

echo
echo "skills:   ${skill_count} -> ${SKILLS_DIR}"
echo "commands: ${command_count} -> ${COMMANDS_DIR}"
echo
echo "Restart opencode for changes to take effect."
