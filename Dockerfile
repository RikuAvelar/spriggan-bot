FROM hayd/deno:latest

WORKDIR /app
ADD . /app

RUN deno cache main.ts

CMD ["run", "--allow-net", '--allow-read', '--unstable', "main.ts"]