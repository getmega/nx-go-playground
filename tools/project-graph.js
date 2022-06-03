const {ProjectGraphBuilder} = require('@nrwl/devkit');
const {basename, extname} = require('path');
const {execSync} = require('child_process');

const workspaceModuleRoot = "getmega.com"

/**
 * Nx Project Graph plugin for go
 *
 * @param {import('@nrwl/devkit').ProjectGraph} graph
 * @param {import('@nrwl/devkit').ProjectGraphProcessorContext} context
 * @returns {import('@nrwl/devkit').ProjectGraph}
 */
exports.processProjectGraph = (graph, context) => {
  const projectRootLookupMap = new Map()
  const projectRoots = []
  for (const projectName in graph.nodes) {
    projectRootLookupMap.set(graph.nodes[projectName].data.root, projectName)
    projectRoots.push(graph.nodes[projectName].data.root)
  }

  const builder = new ProjectGraphBuilder(graph)
  // Define dependencies using the context of files that were changed to minimize work between each run.
  for (const projectName in context.filesToProcess) {
    const files = context.filesToProcess[projectName]
    for (const f of files) {
      if (extname(f.file) !== '.go') {
        continue
      }

      const dependencies = getGoDependencies(projectRootLookupMap, projectRoots, f.file)
      if (!dependencies?.length) {
        continue
      }

      for (const dependency of dependencies) {
        builder.addExplicitDependency(projectName, f.file, dependency)
      }
    }
  }

  return builder.getUpdatedProjectGraph()
}

/**
 * A number, or a string containing a number.
 * @typedef { {Deps?: string[], Module: {Path: string}, Imports?: string[], TestImports?: string[]} } GoPackage
 */

/**
 * getGoDependencies will use `go list` to get dependency information from a go file
 * @param {Map} projectRootLookup
 * @param {string[]} projectRoots
 * @param {string} file
 * @returns {string[]}
 */
const getGoDependencies = (projectRootLookup, projectRoots, file) => {
  const goPackageDataJson = execSync('go list -json ./' + file, {encoding: 'utf-8'})
  /** @type {GoPackage} */
  const goPackage = JSON.parse(goPackageDataJson)
  const isTestFile = basename(file, '.go').endsWith('_test')

  // Use the correct imports list depending on if the file is a test file.
  const listOfImports = (!isTestFile ? goPackage.Imports : goPackage.TestImports) ?? []

  const dependentProjects = new Set()
  for (const d of listOfImports) {
    if (!d.startsWith(workspaceModuleRoot)) {
      continue
    }

    const rootDir = d.substring(workspaceModuleRoot.length + 1)
    const projectRoot = projectRoots.find(projectRoot => rootDir.startsWith(projectRoot))
    const projectName = projectRootLookup.get(projectRoot)
    dependentProjects.add(projectName)
  }

  return [...dependentProjects]
}
