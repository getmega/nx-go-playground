package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os/exec"
)

type replace struct {
	Path  string `json:"Path"`
	Dir   string `json:"Dir"`
	GoMod string `json:"GoMod"`
}

// Check https://golang.org/pkg/cmd/go/internal/list/ from available fields
type pkg struct {
	Path    string   `json:"Path"`
	Main    bool     `json:"Main,omitempty"`
	Dir     string   `json:"Dir"`
	GoMod   string   `json:"GoMod"`
	Replace *replace `json:"Replace,omitempty"`
}

const workspaceGoModName = "github.com/nx-go-playground/demo"

func main() {
	listOutput, err := exec.Command("go", "list", "-m", "-json", "all").Output()
	if err != nil {
		log.Fatalf("failed fetching dependencies from go list: %v", err)
	}

	decoder := json.NewDecoder(bytes.NewReader(listOutput))
	packages := make([]pkg, 0)

	for {
		var p pkg

		if err = decoder.Decode(&p); err != nil {
			if err == io.EOF {
				break
			}

			log.Fatalf("reading go list output: %v", err)
		}

		//// We only care about first party code for this dependency-graph use-case
		//if p.Module != nil && p.Module.Path == workspaceGoModName {
		//  // Ignore anything from directories we know are not relevant
		//  if strings.HasPrefix(p.ImportPath, workspaceGoModName+"/dist") || strings.HasPrefix(p.ImportPath, workspaceGoModName+"/tools") || strings.HasPrefix(p.ImportPath, workspaceGoModName+"/surfaces") || strings.HasPrefix(p.ImportPath, workspaceGoModName+"/node_modules") {
		//    continue
		//  }
		//
		//  filteredDeps := []string{}
		//  for d := range p.Deps {
		//    // Filter out any third party deps
		//    if strings.HasPrefix(p.Deps[d], workspaceGoModName) {
		//      filteredDeps = append(filteredDeps, p.Deps[d])
		//    }
		//  }
		//  p.Deps = filteredDeps
		//  packages = append(packages, p)
		//}

		packages = append(packages, p)
	}

	packagesJson, err := json.Marshal(packages)
	if err != nil {
		log.Fatalf("failed marshaling packages: %v", err)
	}

	fmt.Println(string(packagesJson))
}
