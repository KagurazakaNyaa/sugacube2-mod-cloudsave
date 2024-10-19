FROM node:lts AS builder

RUN corepack enable
WORKDIR /src
RUN git clone --depth=1 https://github.com/Lyoko-Jeremie/sugarcube-2-ModLoader.git /src &&\
    yarn &&\
    yarn run webpack:insertTools

FROM node:lts
COPY --from=builder /src/dist-insertTools /tools
VOLUME [ "/src", "/dist" ]
WORKDIR /dist
CMD [ "node", "/tools/packModZip.js", "/src/boot.json" ]