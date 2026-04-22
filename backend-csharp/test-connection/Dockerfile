FROM mcr.microsoft.com/dotnet/sdk:8.0

# Install FreeTDS + unixODBC
RUN apt-get update && \
    apt-get install -y --no-install-recommends unixodbc tdsodbc && \
    rm -rf /var/lib/apt/lists/*

# Register the FreeTDS driver in ODBC
RUN printf '[FreeTDS]\nDescription=FreeTDS Driver\nDriver=/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so\n' \
    > /etc/odbcinst.ini

WORKDIR /app
COPY . .
RUN dotnet restore
RUN dotnet build -c Release
ENTRYPOINT ["dotnet", "run", "--project", "test.csproj"]
