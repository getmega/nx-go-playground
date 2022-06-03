const { ProjectGraphBuilder } = require('@nrwl/devkit');
const { basename, extname, dirname } = require('path');
const { execSync } = require('child_process');

exports.processProjectGraph = (graph, context) => {
  const projectRootLookupMap = new Map()
  const projectRoots = []
  for (const projectName in graph.nodes) {
    projectRootLookupMap.set(graph.nodes[projectName].data.root, projectName)
    projectRoots.push(graph.nodes[projectName].data.root)
  }

  console.log(projectRootLookupMap, projectRoots)
  const builder = new ProjectGraphBuilder(graph)
  // Define dependencies using the context of files that were changed to minimize work
  // between each run.
  for (const projectName in context.filesToProcess) {
    context.filesToProcess[projectName]
      .filter((f) => extname(f.file) === '.go')
      .map(({ file }) => ({ projectName, file, dependencies: getGoDependencies(projectRootLookupMap, projectRoots, file) }))
      .filter((data) => data.dependencies && data.dependencies.length > 0)
      .forEach(({ projectName, file, dependencies }) => {
        for (const dependency of dependencies) {
          builder.addExplicitDependency(projectName, file, dependency)
        }
      })
  }

  return builder.getUpdatedProjectGraph()
}

/**
 * getGoDependencies will use `go list` to get dependency information from a go file
 * @param projectRootLookup
 * @param projectRoots
 * @param file
 * @returns
 */
const getGoDependencies = (projectRootLookup, projectRoots, file) => {
  const goPackageDataJson = execSync('go list -json ./' + dirname(file), { encoding: 'utf-8' })
  const goPackage = JSON.parse(goPackageDataJson)
  const isTestFile = basename(file, '.go').endsWith('_test')

  // Use the correct imports list depending on if the file is a test file.
  const listOfImports = (!isTestFile ? goPackage.Imports : goPackage.TestImports) ?? []

  const dependentProjects = new Set()
  for (const d of listOfImports) {
    if (!d.startsWith(goPackage.Module.Path)) {
      continue
    }

    const rootDir = d.substring(goPackage.Module.Path.length + 1)
    const projectRoot = projectRoots.find(projectRoot => rootDir.startsWith(projectRoot))
    const projectName = projectRootLookup.get(projectRoot)
    dependentProjects.add(projectName)
  }

  return [...dependentProjects]
}

/**
 * GoPackage shape
 */
// interface GoPackage {
//   Deps?: string[]
//   Module: {
//     Path: string
//   }
//   Imports?: string[]
//   TestImports?: string[]
// }
