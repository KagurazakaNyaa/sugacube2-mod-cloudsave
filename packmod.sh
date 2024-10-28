#!/bin/bash
set -ex

docker build . -t modpacker:latest -f modpack.dockerfile

docker run --rm -u "$(id -u):$(id -g)" -v "$(pwd)/src":/src modpacker:latest
