package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var (
	Logger *slog.Logger
	Conn   *pgxpool.Pool
)

func init() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("unable to read env: ", err)
		os.Exit(0)
	}
	lvl_str := os.Getenv("LOG_LEVEL")

	var lvl slog.Leveler

	switch lvl_str {
	case "DEBUG":
		lvl = slog.LevelDebug
	case "WARN":
		lvl = slog.LevelWarn
	case "ERROR":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}

	Logger = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: lvl}))
	Logger.Info("initialized env", "task", "init env")
}

func main() {

	ctx := context.Background()
	con_str := fmt.Sprintf("postgres://%s:%s@%s:%s/%s", os.Getenv("POSTGRES_USER"), os.Getenv("POSTGRES_PASSWORD"), os.Getenv("POSTGRES_URL"), os.Getenv("POSTGRES_PORT"), os.Getenv("POSTGRES_DB"))

	var err error

	Conn, err = pgxpool.New(ctx, con_str)

	if err != nil {
		Logger.Error("unable to connect to database", "error", err)
		os.Exit(1)
	}

	if err := Conn.Ping(ctx); err != nil {
		Logger.Error("unable to ping database", "error", err)
		os.Exit(1)
	}

	router := chi.NewRouter()
	router.Use(cors.Handler(cors.Options{
		// AllowedOrigins:   []string{"https://foo.com"}, // Use this to allow specific origin hosts
		AllowedOrigins: []string{"https://*", "http://*"},
		// AllowOriginFunc:  func(r *http.Request, origin string) bool { return true },
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300, // Maximum value not ignored by any of major browsers
	}))

	api := humachi.New(router, huma.DefaultConfig("marmot", "0.0.1"))

	huma.Register(api, huma.Operation{
		Method:        http.MethodGet,
		Path:          "/api/datapoints",
		Summary:       "Fetches unique datapoints",
		Tags:          []string{"Datapoints"},
		DefaultStatus: http.StatusOK,
	}, GetDatapoints)

	Logger.Info("server listening", "addr", "http://127.0.0.1:3000", "docs", "http://127.0.0.1:3000/docs")
	if err := http.ListenAndServe("127.0.0.1:3000", router); err != nil {
		Logger.Error("unable to startup webserver", "error", err)
	}

}
