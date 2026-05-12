FROM postgis/postgis:16-3.4-alpine

RUN apk add --no-cache git build-base clang15 llvm15-dev postgresql-dev && \
    cd /tmp && \
    git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git && \
    cd pgvector && \
    make && make install && \
    cd / && rm -rf /tmp/pgvector && \
    apk del git build-base clang15 llvm15-dev
