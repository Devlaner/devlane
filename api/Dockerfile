FROM golang:1.25.9-alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata \
  && addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /out/api ./api
COPY migrations ./migrations

USER app

ENV MIGRATIONS_PATH=/app/migrations

EXPOSE 8080

ENTRYPOINT ["/app/api"]
