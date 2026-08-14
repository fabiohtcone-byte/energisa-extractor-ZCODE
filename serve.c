#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <netinet/in.h>
#include <fcntl.h>
#include <signal.h>

#define PORT 3000
#define BUFSZ (512 * 1024)

static const char *MIME_TYPE(const char *path) {
    if (strstr(path, ".html")) return "text/html; charset=utf-8";
    if (strstr(path, ".js"))   return "application/javascript; charset=utf-8";
    if (strstr(path, ".css"))  return "text/css; charset=utf-8";
    if (strstr(path, ".woff2")) return "font/woff2";
    if (strstr(path, ".woff")) return "font/woff";
    if (strstr(path, ".png"))  return "image/png";
    if (strstr(path, ".svg"))  return "image/svg+xml";
    if (strstr(path, ".ico"))  return "image/x-icon";
    if (strstr(path, ".json")) return "application/json; charset=utf-8";
    if (strstr(path, ".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return "application/octet-stream";
}

static void serve_file(int fd, const char *fpath, int cache) {
    int file_fd = open(fpath, O_RDONLY);
    if (file_fd < 0) {
        const char *msg = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        write(fd, msg, strlen(msg));
        return;
    }
    off_t fsize = lseek(file_fd, 0, SEEK_END);
    lseek(file_fd, 0, SEEK_SET);
    char hdr[512];
    int hlen = snprintf(hdr, sizeof(hdr),
        "HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %ld\r\nConnection: close\r\n%s\r\n",
        MIME_TYPE(fpath), (long)fsize, cache ? "Cache-Control: public, max-age=31536000, immutable\r\n" : "");
    write(fd, hdr, hlen);
    char buf[8192];
    ssize_t n;
    while ((n = read(file_fd, buf, sizeof(buf))) > 0) write(fd, buf, n);
    close(file_fd);
}

static void send_json(int fd, int status, const char *body) {
    char hdr[512];
    int hlen = snprintf(hdr, sizeof(hdr),
        "HTTP/1.1 %d OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: %ld\r\nConnection: close\r\n\r\n",
        status, (long)strlen(body));
    write(fd, hdr, hlen);
    write(fd, body, strlen(body));
}

static void send_404(int fd) {
    const char *msg = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    write(fd, msg, strlen(msg));
}

// Read content-length bytes from socket
static int read_body(int fd, char *buf, int max_len, int content_len) {
    int total = 0;
    while (total < content_len && total < max_len) {
        ssize_t n = read(fd, buf + total, content_len - total);
        if (n <= 0) break;
        total += n;
    }
    return total;
}

// Find a header value in the request
static const char *find_header(const char *req, const char *name) {
    static char val[512];
    char search[256];
    snprintf(search, sizeof(search), "\r\n%s:", name);
    const char *p = strcasestr(req, search);
    if (!p) return "";
    p += strlen(search);
    while (*p == ' ') p++;
    const char *end = strstr(p, "\r\n");
    if (!end) return "";
    int len = end - p;
    if (len >= (int)sizeof(val)) len = sizeof(val) - 1;
    memcpy(val, p, len);
    val[len] = 0;
    return val;
}

static void handle_api_extract(int fd, char *req, int body_len) {
    // Read the request body (multipart form data with PDF)
    char *body = malloc(body_len + 1);
    if (!body || read_body(fd, body, body_len, body_len) < body_len) {
        send_json(fd, 500, "{\"error\":\"failed to read body\"}");
        free(body);
        return;
    }
    body[body_len] = 0;

    // Write body to temp file
    char tmpin[128], tmpout[128];
    snprintf(tmpin, sizeof(tmpin), "/tmp/api-%d.in", getpid());
    snprintf(tmpout, sizeof(tmpout), "/tmp/api-%d.out", getpid());
    int fi = open(tmpin, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    write(fi, body, body_len);
    close(fi);

    // Get content-type for boundary
    const char *ct = find_header(req, "Content-Type");

    // Spawn node handler (short-lived process)
    pid_t pid = fork();
    if (pid == 0) {
        // Child: exec node
        execlp("node", "node", "/home/z/my-project/api-handler.cjs", "extract", tmpin, tmpout, ct, NULL);
        _exit(1);
    }

    // Parent: wait for child (with timeout)
    int status;
    // Simple timeout: use alarm
    alarm(30);
    waitpid(pid, &status, 0);
    alarm(0);

    // Read result
    int fo = open(tmpout, O_RDONLY);
    if (fo < 0) {
        send_json(fd, 500, "{\"error\":\"handler failed\"}");
        unlink(tmpin); unlink(tmpout);
        free(body);
        return;
    }
    char result[BUFSZ];
    int rlen = read(fo, result, sizeof(result) - 1);
    close(fo);
    result[rlen > 0 ? rlen : 0] = 0;

    // Check if it's an error
    if (rlen > 0 && result[0] == '{') {
        send_json(fd, 200, result);
    } else {
        send_json(fd, 500, "{\"error\":\"empty result\"}");
    }

    unlink(tmpin); unlink(tmpout);
    free(body);
}

static void handle_api_excel(int fd, char *req, int body_len) {
    char *body = malloc(body_len + 1);
    if (!body || read_body(fd, body, body_len, body_len) < body_len) {
        send_json(fd, 500, "{\"error\":\"read failed\"}");
        free(body);
        return;
    }
    body[body_len] = 0;

    char tmpin[128], tmpout[128];
    snprintf(tmpin, sizeof(tmpin), "/tmp/api-%d.in", getpid());
    snprintf(tmpout, sizeof(tmpout), "/tmp/api-%d.out", getpid());
    int fi = open(tmpin, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    write(fi, body, body_len);
    close(fi);

    pid_t pid = fork();
    if (pid == 0) {
        execlp("node", "node", "/home/z/my-project/api-handler.cjs", "excel", tmpin, tmpout, NULL);
        _exit(1);
    }

    int status;
    alarm(30);
    waitpid(pid, &status, 0);
    alarm(0);

    // Check for Excel file
    char xlsx_path[256];
    snprintf(xlsx_path, sizeof(xlsx_path), "%s.xlsx", tmpout);
    int fx = open(xlsx_path, O_RDONLY);
    if (fx >= 0) {
        off_t fsize = lseek(fx, 0, SEEK_END);
        lseek(fx, 0, SEEK_SET);
        char hdr[512];
        int hlen = snprintf(hdr, sizeof(hdr),
            "HTTP/1.1 200 OK\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n"
            "Content-Disposition: attachment; filename=\"faturas_energisa.xlsx\"\r\n"
            "Content-Length: %ld\r\nConnection: close\r\n\r\n", (long)fsize);
        write(fd, hdr, hlen);
        char buf[8192];
        ssize_t n;
        while ((n = read(fx, buf, sizeof(buf))) > 0) write(fd, buf, n);
        close(fx);
        unlink(xlsx_path);
    } else {
        // Read JSON error
        int fo = open(tmpout, O_RDONLY);
        if (fo >= 0) {
            char result[4096];
            int rlen = read(fo, result, sizeof(result) - 1);
            close(fo);
            result[rlen > 0 ? rlen : 0] = 0;
            send_json(fd, 500, result);
        } else {
            send_json(fd, 500, "{\"error\":\"excel generation failed\"}");
        }
    }

    unlink(tmpin); unlink(tmpout);
    free(body);
}

static void sigalarm_handler(int sig) { (void)sig; }

int main() {
    signal(SIGALRM, sigalarm_handler);
    signal(SIGCHLD, SIG_DFL);

    int srv = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(PORT);
    addr.sin_addr.s_addr = INADDR_ANY;

    if (bind(srv, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        perror("bind"); return 1;
    }
    listen(srv, 64);
    fprintf(stderr, "> Ready on :%d\n", PORT);
    fflush(stderr);

    while (1) {
        int client = accept(srv, NULL, NULL);
        if (client < 0) continue;

        char *buf = malloc(BUFSZ);
        ssize_t n = read(client, buf, BUFSZ - 1);
        if (n <= 0) { close(client); free(buf); continue; }
        buf[n] = 0;

        char method[16] = {0}, url[2048] = {0};
        sscanf(buf, "%15s %2047s", method, url);

        if (strcmp(method, "POST") == 0 && strcmp(url, "/api/extract-pdf") == 0) {
            // Find Content-Length
            int clen = atoi(find_header(buf, "Content-Length"));
            // Account for body already read in the header buffer
            char *body_start = strstr(buf, "\r\n\r\n");
            if (body_start) {
                body_start += 4;
                int header_len = body_start - buf;
                int body_in_buf = n - header_len;
                // Write remaining body to temp and let handler read rest from socket
                // For simplicity, re-read full body via handler
            }
            handle_api_extract(client, buf, clen);
        }
        else if (strcmp(method, "POST") == 0 && strcmp(url, "/api/export-excel") == 0) {
            int clen = atoi(find_header(buf, "Content-Length"));
            handle_api_excel(client, buf, clen);
        }
        else if (strcmp(method, "GET") == 0) {
            if (strcmp(url, "/") == 0 || strcmp(url, "/index.html") == 0) {
                serve_file(client, "/home/z/my-project/.next/server/app/index.html", 0);
            } else if (strncmp(url, "/_next/", 7) == 0) {
                char fpath[2048];
                snprintf(fpath, sizeof(fpath), "/home/z/my-project/.next%s", url + 6);
                serve_file(client, fpath, 1);
            } else {
                send_404(client);
            }
        } else {
            send_404(client);
        }
        close(client);
        free(buf);
    }
    return 0;
}
