#!/bin/bash
set -ex

docker build . -t modpacker:latest -f modpack.dockerfile

rm -rf dist
mkdir -p dist
docker run --rm -u "$(id -u):$(id -g)" -v "$(pwd)/src":/src -v "$(pwd)/dist":/dist modpacker:latest
