FROM alpine:3 AS downloader

WORKDIR /tmp
RUN apk add --no-cache wget unzip &&\
    wget https://github.com/Lyoko-Jeremie/sugarcube-2-ModLoader/releases/download/tools-1/insertTools.zip &&\
    unzip insertTools.zip -d insertTools

FROM node:lts
COPY --from=downloader /tmp/insertTools /tools
VOLUME [ "/src" ]
WORKDIR /src
CMD [ "node", "/tools/packModZip.js", "/src/boot.json" ]
