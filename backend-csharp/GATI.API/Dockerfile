FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app
COPY backend-csharp/GATI.API/ .
RUN dotnet publish -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends unixodbc tdsodbc && \
    rm -rf /var/lib/apt/lists/*

RUN printf '[FreeTDS]\nDescription=FreeTDS Driver\nDriver=/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so\n' \
    > /etc/odbcinst.ini

COPY --from=build /out .
COPY frontend/public/funcesi.png .

EXPOSE 8080
ENTRYPOINT ["dotnet", "GATI.API.dll"]
