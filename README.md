# Federated Wiki - Topicmap Plugin

This plugin, type: topicmap, extends the markup of the federated wiki.

## Build

    cd ~/workspace/wiki-plugin-topicmap
    npm pack -s
    cd ~/workspace/wiki/node_modules/wiki
    npm i $(npm pack ../../../wiki-plugin-topicmap | tail -1)

Usage (from `wiki-plugin-topicmap`):

```
# one-shot: pack plugin + start wiki
nix develop -c pack_and_run

# or the pieces:
nix develop -c pack_install
nix develop -c wiki_run

# watch the plugin and re-pack on edits
nix develop -c pack_install_watch

# override paths/port as needed:
WIKI_DIR=~/workspace/wiki/node_modules/wiki \
WIKI_CONFIG=~/workspace/wiki-client/config.json.safe \
WIKI_PORT=3333 \
nix develop -c wiki_run
```

Tip: if you want hot-ish reloads, run `pack_install_watch` in one terminal and `wiki_run` in another; restart the wiki when you need the new tarball to be picked up.

## License

MIT