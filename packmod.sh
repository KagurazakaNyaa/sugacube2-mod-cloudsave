#!/bin/bash
set -ex

BUILDER_IMAGE=${BUILDER_IMAGE:-ghcr.io/lyoko-jeremie/sugarcube-2-modloader-inserttools:latest}

docker run --rm -u "$(id -u):$(id -g)" -v "$(pwd)/src":/src "${BUILDER_IMAGE}"
