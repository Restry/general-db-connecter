yarn run tsbuild || true

docker build --pull --rm -f "Dockerfile" -t restry/general-db-connecter:latest "."