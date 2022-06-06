const { ProjectGraphBuilder } = require('@nrwl/devkit')
const { basename, extname, dirname } = require('path')
const { execSync } = require('child_process')

const workspaceModuleRoot = 'getmega.com'

/**
 * A number, or a string containing a number.
 * @typedef { {Imports?: string[] } } GoPackage
 */

/**
 * Nx Project Graph plugin for go
 *
 * @param {import('@nrwl/devkit').ProjectGraph} graph
 * @param {import('@nrwl/devkit').ProjectGraphProcessorContext} context
 * @returns {import('@nrwl/devkit').ProjectGraph}
 */
exports.processProjectGraph = (graph, context) => {
  const projectRootLookup = new Map()
  const projectRoots = []
  for (const projectName in graph.nodes) {
    projectRootLookup.set(graph.nodes[projectName].data.root, projectName)
    projectRoots.push(graph.nodes[projectName].data.root)
  }

  const builder = new ProjectGraphBuilder(graph)
  // buildDependenciesUsingFiles(context, builder, projectRoots, projectRootLookup)
  buildDependenciesUsingPackages(context, builder, projectRoots, projectRootLookup)
  return builder.getUpdatedProjectGraph()
}

/**
 * @param {import('@nrwl/devkit').ProjectGraphProcessorContext} context
 * @param {import('@nrwl/devkit').ProjectGraphBuilder} builder
 * @param {string[]} projectRoots
 * @param {Map<string, string>} projectRootLookup
 */
const buildDependenciesUsingPackages = (context, builder, projectRoots, projectRootLookup) => {
  // project name to set of go packages
  /** @type {{[projectName: string]: Set}} */
  const goPackages = {}
  for (const projectName in context.filesToProcess) {
    if (!goPackages[projectName]) {
      goPackages[projectName] = new Set()
    }

    const files = context.filesToProcess[projectName]
    for (const f of files) {
      if (extname(f.file) !== '.go') {
        continue
      }

      goPackages[projectName].add(dirname(f.file))
    }
  }

  // for each package get dependencies
  for (const projectName in goPackages) {
    const packagesToProcess = goPackages[projectName]
    for (const goPackage of packagesToProcess) {
      const dependencies = getPackageDependencies(goPackage, projectName, projectRoots, projectRootLookup)
      if (!dependencies || dependencies.length === 0) {
        continue
      }

      // add each of these dependencies to the project as implicit
      for (const dependency of dependencies) {
        builder.addImplicitDependency(projectName, dependency)
      }
    }
  }
}

/**
 * @param {import('@nrwl/devkit').ProjectGraphProcessorContext} context
 * @param {import('@nrwl/devkit').ProjectGraphBuilder} builder
 * @param {string[]} projectRoots
 * @param {Map<string, string>} projectRootLookup
 */
const buildDependenciesUsingFiles = (context, builder, projectRoots, projectRootLookup) => {
  // Define dependencies using the context of files that were changed to minimize work between each run.
  for (const projectName in context.filesToProcess) {
    const files = context.filesToProcess[projectName]
    for (const f of files) {
      if (extname(f.file) !== '.go') {
        continue
      }

      const dependencies = getFileDependencies(f.file, projectName, projectRoots, projectRootLookup)
      if (!dependencies || dependencies.length === 0) {
        continue
      }

      for (const dependency of dependencies) {
        builder.addExplicitDependency(projectName, f.file, dependency)
      }
    }
  }
}

/**
 * getImportsOfPackage will use `go list` to get list of imports of a go package
 * @param {string} goPackage
 * @returns {string[]}
 */
const getImportsOfPackage = (goPackage) => {
  const formatter = `{ "Imports": [{{ range $i, $e := .Imports }}{{ if $i }},{{ end }}"{{ $e }}"{{ end }}] }`
  const goPackageDataJson = execSync(`cd ${goPackage} && go list -f '${formatter}' .`, {
    encoding: 'utf-8',
  })
  /** @type {GoPackage} */
  const goPackageData = JSON.parse(goPackageDataJson)

  return goPackageData.Imports || []
}

/**
 * getImportsOfFile will use `go list` to get list of imports of a go file
 * @param {string} file
 * @returns {string[]}
 */
const getImportsOfFile = (file) => {
  // Use the correct imports list depending on if the file is a test file.
  const isTestFile = basename(file, '.go').endsWith('_test')
  let formatter = `{ "Imports": [{{ range $i, $e := .Imports }}{{ if $i }},{{ end }}"{{ $e }}"{{ end }}] }`
  if (isTestFile) {
    formatter = `{ "Imports": [{{ range $i, $e := .TestImports }}{{ if $i }},{{ end }}"{{ $e }}"{{ end }}] }`
  }

  const goPackageDataJson = execSync(`go list -f '${formatter}' ./${file}`, {
    encoding: 'utf-8',
  })
  /** @type {GoPackage} */
  const goPackageData = JSON.parse(goPackageDataJson)

  return goPackageData.Imports || []
}

/**
 * getDependenciesFromImports will get first party dependent projects from imports
 * @param {string[]} imports
 * @param {string} selfProject
 * @param {string[]} projectRoots
 * @param {Map<string, string>} projectRootLookup
 * @returns {string[]}
 */
const getDependenciesFromImports = (imports, selfProject, projectRoots, projectRootLookup) => {
  const dependentProjects = new Set()
  for (const i of imports) {
    if (!i.startsWith(workspaceModuleRoot)) {
      continue
    }

    const rootDir = i.substring(workspaceModuleRoot.length + 1)
    const projectRoot = projectRoots.find(projectRoot => rootDir.startsWith(projectRoot))
    const projectName = projectRootLookup.get(projectRoot)
    if (projectName && projectName !== selfProject) {
      dependentProjects.add(projectName)
    }
  }

  return [...dependentProjects]
}

/**
 * getPackageDependencies will use `go list` to get dependency information from a go package
 * @param {string} goPackage
 * @param {string} selfProject
 * @param {string[]} projectRoots
 * @param {Map<string, string>} projectRootLookup
 * @returns {string[]}
 */
const getPackageDependencies = (goPackage, selfProject, projectRoots, projectRootLookup) => {
  const imports = getImportsOfPackage(goPackage)
  return getDependenciesFromImports(imports, selfProject, projectRoots, projectRootLookup)
}

/**
 * getFileDependencies will use `go list` to get dependency information from a go file
 * @param {string} file
 * @param {string} selfProject
 * @param {string[]} projectRoots
 * @param {Map<string, string>} projectRootLookup
 * @returns {string[]}
 */
const getFileDependencies = (file, selfProject, projectRoots, projectRootLookup) => {
  const imports = getImportsOfFile(file)
  return getDependenciesFromImports(imports, selfProject, projectRoots, projectRootLookup)
}
