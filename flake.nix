{
  description = "wiki-plugin-topicmap dev shell with pack/install + local wiki runner";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

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
            WIKI_CONFIG="''\${WIKI_CONFIG:-$HOME/workspace/wiki-client/config.json.safe}"
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
          ];
          shellHook = ''
            export TOPICMAP_DIR="''\${TOPICMAP_DIR:-$PWD}"
            export WIKI_DIR="''\${WIKI_DIR:-$HOME/workspace/wiki/node_modules/wiki}"
            export WIKI_CONFIG="''\${WIKI_CONFIG:-$HOME/workspace/wiki/config.json.safe}"
            export WIKI_PORT="''\${WIKI_PORT:-3333}"

            echo "Commands: pack_install | wiki_run | pack_and_run | pack_install_watch"
            echo "Current:"
            echo "  TOPICMAP_DIR=$TOPICMAP_DIR"
            echo "  WIKI_DIR=$WIKI_DIR"
            echo "  WIKI_CONFIG=$WIKI_CONFIG"
            echo "  WIKI_PORT=$WIKI_PORT"
          '';
        };

        apps.pack_install = { type = "app"; program = "${pack_install_app}/bin/pack_install"; };
        apps.wiki_run     = { type = "app"; program = "${wiki_run_app}/bin/wiki_run"; };
        apps.pack_and_run = { type = "app"; program = "${pack_and_run_app}/bin/pack_and_run"; };
        apps.pack_install_watch = { type = "app"; program = "${pack_install_watch_app}/bin/pack_install_watch"; };

        packages.pack_install = pack_install_app;
        packages.wiki_run = wiki_run_app;
        packages.pack_and_run = pack_and_run_app;
        packages.pack_install_watch = pack_install_watch_app;
      });
}
