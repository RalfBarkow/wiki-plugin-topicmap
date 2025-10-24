{
  description = "wiki-plugin-topicmap dev shell with pack/install + local wiki runner + Stylelint";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # --- Existing tooling -------------------------------------------------
        pack_install_app = pkgs.writeShellApplication {
          name = "pack_install";
          runtimeInputs = [ pkgs.nodejs_20 pkgs.git ];
          text = ''
            set -euo pipefail

            TOPICMAP_DIR="''\${TOPICMAP_DIR:-$PWD}"
            WIKI_DIR="''\${WIKI_DIR:-$HOME/workspace/wiki/node_modules/wiki}"

            [ -f "''${TOPICMAP_DIR}/package.json" ] || { echo "ERROR: package.json not found in TOPICMAP_DIR: ''${TOPICMAP_DIR}" >&2; exit 1; }
            [ -d "''${WIKI_DIR}" ] || { echo "ERROR: WIKI_DIR does not exist: ''${WIKI_DIR}" >&2; exit 1; }

            echo "• Packing from: ''${TOPICMAP_DIR}"
            echo "• Installing into: ''${WIKI_DIR}"

            pushd "''${WIKI_DIR}" >/dev/null
            tgz="$(npm pack "''${TOPICMAP_DIR}" | tail -n1)"
            npm i "''${tgz}"
            echo "✔ Installed ''${tgz}"
            popd >/dev/null
          '';
        };

        wiki_run_app = pkgs.writeShellApplication {
          name = "wiki_run";
          runtimeInputs = [ pkgs.nodejs_20 ];
          text = ''
            set -euo pipefail

            WIKI_DIR="''\${WIKI_DIR:-$HOME/workspace/wiki/node_modules/wiki}"
            WIKI_CONFIG="''\${WIKI_CONFIG:-$HOME/workspace/wiki/config.json.safe}"
            WIKI_PORT="''\${WIKI_PORT:-3333}"

            [ -d "''${WIKI_DIR}" ] || { echo "ERROR: WIKI_DIR does not exist: ''${WIKI_DIR}" >&2; exit 1; }
            [ -f "''${WIKI_CONFIG}" ] || { echo "ERROR: WIKI_CONFIG not found: ''${WIKI_CONFIG}" >&2; exit 1; }

            cd "''${WIKI_DIR}"
            echo "• Running wiki: node --trace-deprecation index.js --config ''${WIKI_CONFIG} --port ''${WIKI_PORT}"
            exec node --trace-deprecation index.js --config "''${WIKI_CONFIG}" --port "''${WIKI_PORT}"
          '';
        };

        pack_and_run_app = pkgs.writeShellApplication {
          name = "pack_and_run";
          runtimeInputs = [ pack_install_app wiki_run_app ];
          text = ''
            set -euo pipefail
            pack_install
            wiki_run
          '';
        };

        pack_install_watch_app = pkgs.writeShellApplication {
          name = "pack_install_watch";
          runtimeInputs = [ pkgs.watchexec pack_install_app ];
          text = ''
            set -euo pipefail
            TOPICMAP_DIR="''\${TOPICMAP_DIR:-$PWD}"
            echo "• Watching ''${TOPICMAP_DIR} for changes … (js,ts,elm,json,css,md)"
            exec watchexec \
              -w "''${TOPICMAP_DIR}" \
              -e js,ts,elm,json,css,md \
              -- pack_install
          '';
        };

        # --- Stylelint integration -------------------------------------------
        stylelint_init_app = pkgs.writeShellApplication {
          name = "stylelint_init";
          runtimeInputs = [ pkgs.nodejs_20 ];
          text = ''
            set -euo pipefail
            TOPICMAP_DIR="''\${TOPICMAP_DIR:-$PWD}"
            cd "''${TOPICMAP_DIR}"
            [ -f package.json ] || { echo "ERROR: no package.json in ''${TOPICMAP_DIR}" >&2; exit 1; }

            echo "• Installing Stylelint dev deps (idempotent)…"
            npm i -D stylelint stylelint-config-standard @double-great/stylelint-a11y stylelint-no-unsupported-browser-features postcss-html >/dev/null

            if [ ! -f stylelint.config.mjs ]; then
              cat > stylelint.config.mjs <<'EOF'
/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["@double-great/stylelint-a11y", "stylelint-no-unsupported-browser-features"],
  rules: {
    "function-no-unknown": [true, { ignoreFunctions: ["color-mix"] }],
    "a11y/no-outline-none": true,
    "plugin/no-unsupported-browser-features": [true, { severity: "warning" }]
  },
  overrides: [
    { files: ["**/*.html", "**/*.vue"], customSyntax: "postcss-html" }
  ]
};
EOF
              echo "✔ Wrote stylelint.config.mjs"
            else
              echo "• stylelint.config.mjs exists — leaving it untouched"
            fi

            if [ ! -f .stylelintignore ]; then
              cat > .stylelintignore <<'EOF'
dist/**
**/*.min.css
node_modules/**
EOF
              echo "✔ Wrote .stylelintignore"
            else
              echo "• .stylelintignore exists — leaving it untouched"
            fi

            npm pkg set scripts.lint\\:css="stylelint \"client/**/*.css\" \"theme/**/*.css\" \"**/*.html\" \"**/*.vue\"" >/dev/null
            npm pkg set scripts.lint\\:css\\:fix="stylelint \"client/**/*.css\" \"theme/**/*.css\" \"**/*.html\" \"**/*.vue\" --fix" >/dev/null
            echo "✔ npm scripts: lint:css, lint:css:fix"
          '';
        };

        # Safe glob handling: split into Bash array, then expand.
        stylelint_run_app = pkgs.writeShellApplication {
          name = "stylelint_run";
          runtimeInputs = [ pkgs.nodejs_20 ];
          text = ''
            set -euo pipefail
            TOPICMAP_DIR="''\${TOPICMAP_DIR:-$PWD}"
            STYLELINT_GLOBS="''\${STYLELINT_GLOBS:-client/**/*.css theme/**/*.css **/*.html **/*.vue}"
            cd "''${TOPICMAP_DIR}"
            [ -f package.json ] || { echo "ERROR: no package.json in ''${TOPICMAP_DIR}" >&2; exit 1; }
            # shellcheck disable=SC2206
            read -r -a GLOBS <<< "''${STYLELINT_GLOBS}"
            npx --yes stylelint "''${GLOBS[@]}"
          '';
        };

        stylelint_fix_app = pkgs.writeShellApplication {
          name = "stylelint_fix";
          runtimeInputs = [ pkgs.nodejs_20 ];
          text = ''
            set -euo pipefail
            TOPICMAP_DIR="''\${TOPICMAP_DIR:-$PWD}"
            STYLELINT_GLOBS="''\${STYLELINT_GLOBS:-client/**/*.css theme/**/*.css **/*.html **/*.vue}"
            cd "''${TOPICMAP_DIR}"
            [ -f package.json ] || { echo "ERROR: no package.json in ''${TOPICMAP_DIR}" >&2; exit 1; }
            # shellcheck disable=SC2206
            read -r -a GLOBS <<< "''${STYLELINT_GLOBS}"
            npx --yes stylelint "''${GLOBS[@]}" --fix
          '';
        };

        stylelint_watch_app = pkgs.writeShellApplication {
          name = "stylelint_watch";
          runtimeInputs = [ pkgs.watchexec stylelint_run_app ];
          text = ''
            set -euo pipefail
            TOPICMAP_DIR="''\${TOPICMAP_DIR:-$PWD}"
            echo "• Watching ''${TOPICMAP_DIR} for CSS/HTML/Vue changes …"
            exec watchexec \
              -w "''${TOPICMAP_DIR}" \
              -e css,html,vue \
              -- stylelint_run
          '';
        };

      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_20
            pkgs.git
            pkgs.watchexec
            pack_install_app
            wiki_run_app
            pack_and_run_app
            pack_install_watch_app
            stylelint_init_app
            stylelint_run_app
            stylelint_fix_app
            stylelint_watch_app
          ];
          shellHook = ''
            export TOPICMAP_DIR="''\${TOPICMAP_DIR:-$PWD}"
            export WIKI_DIR="''\${WIKI_DIR:-$HOME/workspace/wiki/node_modules/wiki}"
            export WIKI_CONFIG="''\${WIKI_CONFIG:-$HOME/workspace/wiki/config.json.safe}"
            export WIKI_PORT="''\${WIKI_PORT:-3333}"
            export STYLELINT_GLOBS="''\${STYLELINT_GLOBS:-client/**/*.css theme/**/*.css **/*.html **/*.vue}"

            echo "Commands:"
            echo "  pack_install | wiki_run | pack_and_run | pack_install_watch"
            echo "  stylelint_init | stylelint_run | stylelint_fix | stylelint_watch"
            echo "Current:"
            echo "  TOPICMAP_DIR=$TOPICMAP_DIR"
            echo "  WIKI_DIR=$WIKI_DIR"
            echo "  WIKI_CONFIG=$WIKI_CONFIG"
            echo "  WIKI_PORT=$WIKI_PORT"
            echo "  STYLELINT_GLOBS=$STYLELINT_GLOBS"
          '';
        };

        apps.pack_install       = { type = "app"; program = "${pack_install_app}/bin/pack_install"; };
        apps.wiki_run           = { type = "app"; program = "${wiki_run_app}/bin/wiki_run"; };
        apps.pack_and_run       = { type = "app"; program = "${pack_and_run_app}/bin/pack_and_run"; };
        apps.pack_install_watch = { type = "app"; program = "${pack_install_watch_app}/bin/pack_install_watch"; };

        apps.stylelint_init     = { type = "app"; program = "${stylelint_init_app}/bin/stylelint_init"; };
        apps.stylelint_run      = { type = "app"; program = "${stylelint_run_app}/bin/stylelint_run"; };
        apps.stylelint_fix      = { type = "app"; program = "${stylelint_fix_app}/bin/stylelint_fix"; };
        apps.stylelint_watch    = { type = "app"; program = "${stylelint_watch_app}/bin/stylelint_watch"; };

        packages.pack_install = pack_install_app;
        packages.wiki_run = wiki_run_app;
        packages.pack_and_run = pack_and_run_app;
        packages.pack_install_watch = pack_install_watch_app;

        packages.stylelint_init = stylelint_init_app;
        packages.stylelint_run = stylelint_run_app;
        packages.stylelint_fix = stylelint_fix_app;
        packages.stylelint_watch = stylelint_watch_app;
      });
}
