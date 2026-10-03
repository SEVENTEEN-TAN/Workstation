#!/usr/bin/env bash
set -Eeuo pipefail

# Runs on the Linux host with Git, Docker and Docker Compose v2; no host Node needed.
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
config="${WORKSTATION_DEPLOY_DIR:-$(dirname "$repo")/workstation-deploy}"
ref=origin/main
legacy=
while (( $# )); do
  case "$1" in
    --legacy-container) legacy="${2:?Missing legacy container name}"; shift 2 ;;
    --*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) ref="$1"; shift ;;
  esac
done
die() { echo "$*" >&2; exit 1; }
command -v git >/dev/null || die "Git is required."
docker info >/dev/null
docker compose version >/dev/null
mkdir -p "$config"
chmod 700 "$config"
if [[ ! -e "$config/.env" ]]; then
  cp "$repo/deploy/container.env.example" "$config/.env"
  chmod 600 "$config/.env"
fi
setting() {
  local value
  value="$(sed -n "s/^$1=//p" "$config/.env" | tail -1)"
  printf '%s' "${value:-$2}"
}
data="$(setting WORKSTATION_DATA_DIR /usr/local/dev/workstation-data)"
[[ "$data" =~ ^/[a-zA-Z0-9_./-]+$ && "$data" != / ]] || die "WORKSTATION_DATA_DIR must be an absolute path without spaces."
mkdir -p "$data"
# Avoid concurrent updates. A stale lock after a host crash requires manual inspection.
mkdir "$config/update.lock" 2>/dev/null || die "Another update holds $config/update.lock."
checkout=
stopped=false
migration_started=false
backup=
previous=
image=
dc() { WORKSTATION_IMAGE="$image" docker compose --project-name workstation-managed --env-file "$config/.env" -f "$config/compose.yaml" "$@"; }
cleanup() {
  local status=$?
  trap - EXIT
  if (( status != 0 )) && $stopped; then
    if ! $migration_started; then
      if [[ -n "$legacy" ]]; then docker start "$legacy" >&2 || true
      elif [[ -n "$previous" ]]; then image="$previous"; dc start app >&2 || true; fi
    else
      dc stop app >&2 || true
      echo "Migration has started; service remains stopped. Do not restart old code before inspecting/restoring its matching backup." >&2
      echo "Previous image: ${previous:-legacy:$legacy}; backup: ${backup:-none}; new image: $image" >&2
    fi
  fi
  if [[ -n "$checkout" ]]; then git -C "$repo" worktree remove --force "$checkout" >/dev/null 2>&1 || true; fi
  rmdir "$config/update.lock"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

git -C "$repo" fetch origin
commit="$(git -C "$repo" rev-parse --verify "${ref}^{commit}")"
image="workstation-local:$commit"
checkout="$(mktemp -d "${TMPDIR:-/tmp}/workstation-source.XXXXXX")"
git -C "$repo" worktree add --detach "$checkout" "$commit"
[[ -f "$checkout/Dockerfile" && -f "$checkout/compose.yaml" ]] || die "Target version has no container deployment files."
echo "Building $commit before stopping any application..."
docker build --label "org.opencontainers.image.revision=$commit" -t "$image" "$checkout"
# Verify the image can migrate a disposable DB; never mounts production data.
docker run --rm -e DATABASE_URL=file:/tmp/workstation-check.db "$image" npx prisma migrate deploy
if [[ -f "$config/current-image" ]]; then
  previous="$(cat "$config/current-image")"
  [[ "$previous" =~ ^workstation-local:[a-f0-9]{40}$ ]] || die "Invalid current-image state."
  [[ -z "$legacy" ]] || die "Already managed; omit --legacy-container."
fi
cp "$checkout/compose.yaml" "$config/compose.yaml"
dc config --quiet
container="$(dc ps --all --quiet app)"
if [[ -n "$legacy" ]]; then
  [[ -z "$container" ]] || die "A managed container already exists."
  container="$legacy"
elif [[ -n "$container" && -z "$previous" ]]; then
  die "Managed container exists without current-image state; inspect before updating."
fi
if [[ -n "$container" ]]; then
  actual_data="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' "$container")"
  [[ "$actual_data" == "$data" ]] || die "Container /data mount does not match $data."
  stopped=true
  if [[ -n "$legacy" ]]; then docker stop "$legacy"; else dc stop app; fi
fi
# No other processes may write this data directory during the maintenance window.
if [[ -f "$data/workstation.db" ]]; then
  backup_image="${previous:-$image}"
  backup_output="$(WORKSTATION_IMAGE="$backup_image" docker compose --project-name workstation-managed --env-file "$config/.env" -f "$config/compose.yaml" run --rm --no-deps app npm run db:backup)"
  printf '%s\n' "$backup_output"
  backup="$(printf '%s\n' "$backup_output" | sed -n '/^\/data\/backups\//p' | head -1)"
  [[ -n "$backup" && -f "$data${backup#/data}/manifest.json" ]] || die "Backup did not produce a complete manifest."
fi
printf 'previous_image=%s\nnew_image=%s\nbackup=%s\nlegacy_container=%s\n' "$previous" "$image" "$backup" "$legacy" > "$config/last-update"
migration_started=true
stopped=true
dc run --rm --no-deps app npx prisma migrate deploy
dc up --detach --no-build --wait --wait-timeout 120 app
printf '%s\n' "$image" > "$config/current-image"
printf 'WORKSTATION_IMAGE=%s\n' "$image" > "$config/image.env"
echo "Updated to $commit. HTTP health check passed; verify the HTTPS domain and admin separately."
