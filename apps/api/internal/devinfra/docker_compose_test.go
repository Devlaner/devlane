// Package devinfra contains regression tests for the repository's local
// development infrastructure definition (docker-compose.yml). These tests
// do not spin up containers; they statically validate the compose file's
// contents, in particular that published ports remain bound to the loopback
// interface so the default-credentialed dev services (postgres, redis,
// rabbitmq, minio) are not reachable from other hosts on the network.
package devinfra

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

// repoRoot returns the absolute path to the repository root, derived from
// this file's own source location so the test works regardless of the
// working directory it's invoked from. Mirrors the pattern used in
// internal/testutil/pg.go for locating the migrations directory.
func repoRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("unable to determine caller for repoRoot")
	}
	// file = .../apps/api/internal/devinfra/docker_compose_test.go
	root, err := filepath.Abs(filepath.Join(filepath.Dir(file), "..", "..", "..", ".."))
	if err != nil {
		t.Fatalf("resolving repo root: %v", err)
	}
	return root
}

func readDockerCompose(t *testing.T) string {
	t.Helper()
	path := filepath.Join(repoRoot(t), "docker-compose.yml")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading docker-compose.yml: %v", err)
	}
	return string(data)
}

var (
	serviceRe    = regexp.MustCompile(`^  (\S+):\s*$`)
	portsKeyRe   = regexp.MustCompile(`^\s{4}ports:\s*$`)
	portEntryRe  = regexp.MustCompile(`^\s{6}-\s*"([^"]+)"\s*$`)
	otherKeyRe   = regexp.MustCompile(`^\s{4}\S`)
	topVolumesRe = regexp.MustCompile(`^volumes:\s*$`)
)

// servicePorts extracts, for each top-level service block in docker-compose.yml,
// the list of "ports:" entries beneath it (e.g. "127.0.0.1:5672:5672"). It
// relies on the file's two-space service indentation and four/six-space
// key/list indentation for the "ports:" section.
func servicePorts(content string) map[string][]string {
	lines := strings.Split(content, "\n")

	result := map[string][]string{}
	currentService := ""
	inPorts := false

	for _, line := range lines {
		// The named-volumes block at the bottom of the file uses the same
		// two-space indentation as service names; stop before it so volume
		// names aren't mistaken for services.
		if topVolumesRe.MatchString(line) {
			break
		}
		if m := serviceRe.FindStringSubmatch(line); m != nil {
			currentService = m[1]
			inPorts = false
			continue
		}
		if currentService == "" {
			continue
		}
		if portsKeyRe.MatchString(line) {
			inPorts = true
			continue
		}
		if !inPorts {
			continue
		}
		if m := portEntryRe.FindStringSubmatch(line); m != nil {
			result[currentService] = append(result[currentService], m[1])
			continue
		}
		// Any other four-space-indented key ends the ports list.
		if otherKeyRe.MatchString(line) {
			inPorts = false
		}
	}
	return result
}

func TestDockerComposeParses(t *testing.T) {
	content := readDockerCompose(t)
	if !strings.Contains(content, "services:") {
		t.Fatal("docker-compose.yml missing top-level services key")
	}
	ports := servicePorts(content)
	if len(ports) == 0 {
		t.Fatal("no services with port mappings were found; test harness may be broken")
	}
}

// TestServicePorts exercises the parsing helper directly against synthetic
// compose snippets, so failures in the tests above can be traced back to
// either a real docker-compose.yml regression or a parser bug.
func TestServicePorts(t *testing.T) {
	cases := []struct {
		name    string
		content string
		want    map[string][]string
	}{
		{
			name: "loopback-bound ports",
			content: "services:\n" +
				"  postgres:\n" +
				"    image: postgres:16-alpine\n" +
				"    ports:\n" +
				"      - \"127.0.0.1:15432:5432\"\n" +
				"    volumes:\n" +
				"      - postgres_data:/var/lib/postgresql/data\n",
			want: map[string][]string{"postgres": {"127.0.0.1:15432:5432"}},
		},
		{
			name: "bare port mapping is still extracted verbatim",
			content: "services:\n" +
				"  redis:\n" +
				"    ports:\n" +
				"      - \"6379:6379\"\n",
			want: map[string][]string{"redis": {"6379:6379"}},
		},
		{
			name: "multiple ports for one service",
			content: "services:\n" +
				"  rabbitmq:\n" +
				"    ports:\n" +
				"      - \"127.0.0.1:5672:5672\"\n" +
				"      - \"127.0.0.1:15672:15672\"\n" +
				"    volumes:\n" +
				"      - rabbitmq_data:/var/lib/rabbitmq\n",
			want: map[string][]string{"rabbitmq": {"127.0.0.1:5672:5672", "127.0.0.1:15672:15672"}},
		},
		{
			name: "service with no ports key yields no entries",
			content: "services:\n" +
				"  worker:\n" +
				"    image: alpine\n" +
				"    volumes:\n" +
				"      - worker_data:/data\n",
			want: map[string][]string{},
		},
		{
			name: "top-level named volumes are not mistaken for services",
			content: "services:\n" +
				"  postgres:\n" +
				"    ports:\n" +
				"      - \"127.0.0.1:15432:5432\"\n" +
				"\n" +
				"volumes:\n" +
				"  postgres_data:\n" +
				"  redis_data:\n",
			want: map[string][]string{"postgres": {"127.0.0.1:15432:5432"}},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := servicePorts(tc.content)
			if len(got) != len(tc.want) {
				t.Fatalf("got %d service(s) %v, want %d %v", len(got), got, len(tc.want), tc.want)
			}
			for svc, wantEntries := range tc.want {
				gotEntries := got[svc]
				if len(gotEntries) != len(wantEntries) {
					t.Fatalf("service %q: got %v, want %v", svc, gotEntries, wantEntries)
				}
				for i, want := range wantEntries {
					if gotEntries[i] != want {
						t.Errorf("service %q: port[%d] = %q, want %q", svc, i, gotEntries[i], want)
					}
				}
			}
		})
	}
}

func TestDockerComposePortsAreBoundToLoopback(t *testing.T) {
	content := readDockerCompose(t)
	ports := servicePorts(content)

	wantServicesWithPorts := []string{"postgres", "redis", "rabbitmq", "minio"}
	for _, svc := range wantServicesWithPorts {
		entries, ok := ports[svc]
		if !ok || len(entries) == 0 {
			t.Errorf("service %q: expected at least one port mapping, found none", svc)
			continue
		}
		for _, entry := range entries {
			if !strings.HasPrefix(entry, "127.0.0.1:") {
				t.Errorf("service %q: port mapping %q is not bound to 127.0.0.1 (regression: publishes to all interfaces)", svc, entry)
			}
		}
	}
}

func TestDockerComposeExpectedPortMappings(t *testing.T) {
	content := readDockerCompose(t)
	ports := servicePorts(content)

	want := map[string][]string{
		"postgres": {"127.0.0.1:15432:5432"},
		"redis":    {"127.0.0.1:6379:6379"},
		"rabbitmq": {"127.0.0.1:5672:5672", "127.0.0.1:15672:15672"},
		"minio":    {"127.0.0.1:9000:9000", "127.0.0.1:9001:9001"},
	}

	for svc, wantEntries := range want {
		gotEntries := ports[svc]
		if len(gotEntries) != len(wantEntries) {
			t.Fatalf("service %q: got %d port mapping(s) %v, want %d %v", svc, len(gotEntries), gotEntries, len(wantEntries), wantEntries)
		}
		for i, want := range wantEntries {
			if gotEntries[i] != want {
				t.Errorf("service %q: port[%d] = %q, want %q", svc, i, gotEntries[i], want)
			}
		}
	}
}

// TestDockerComposeNoWildcardHostBindings guards against the port mappings
// being changed to explicitly bind on all interfaces.
func TestDockerComposeNoWildcardHostBindings(t *testing.T) {
	content := readDockerCompose(t)

	forbidden := []string{"0.0.0.0:", "[::]:"}
	for _, pattern := range forbidden {
		if strings.Contains(content, pattern) {
			t.Errorf("docker-compose.yml contains a wildcard host binding %q; all published ports must be bound to 127.0.0.1", pattern)
		}
	}
}

// TestDockerComposeNoBarePortMappings guards against regressing to
// unqualified "host:container" mappings (e.g. "5672:5672"), which Docker
// publishes on all interfaces by default when no bind address is given.
func TestDockerComposeNoBarePortMappings(t *testing.T) {
	content := readDockerCompose(t)
	barePortRe := regexp.MustCompile(`(?m)^\s*-\s*"\d+:\d+"\s*$`)
	if loc := barePortRe.FindStringIndex(content); loc != nil {
		t.Errorf("found bare host:container port mapping without an explicit bind address: %q", strings.TrimSpace(content[loc[0]:loc[1]]))
	}
}