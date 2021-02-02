FROM hayd/deno:latest

WORKDIR /app
ADD . /app

RUN deno cache --unstable main.ts

CMD ["run", "--allow-net", '--allow-read', '--unstable', "main.ts"]