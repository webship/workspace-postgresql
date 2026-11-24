Feature: The PostgreSQL plugin
  Once the plugin is activated and installed, a project row whose database is PostgreSQL carries the DATABASE menu,
  the plugin has its page in Settings with its settings and its tool, and its AI items are in the folders of their
  kind. (The menu itself needs a PostgreSQL project, which the browser suite's workspace has not: the unit tests draw
  it, and the README says on which real projects it was run.)

  # Settings lists every plugin the workspace has, by family; the package is on the plugin's own page.
  Scenario: Settings lists the plugin, and its own page names its package, its settings and its tool
    Given I am on "/settings"
     Then I should see "PostgreSQL"
     When I go to "/settings/plugin/postgresql"
     Then I should see "@webship.co/workspace-postgresql"
      And I should see "Web admin"
      And I should see "Exports kept per project"
      And I should see "cmd-tools-postgresql.sh"

  # The AI folders are searched by name: with every plugin on, a folder lists more than one page of items.
  Scenario: The AI Agents folder lists the agent the plugin ships
    Given I am on "/ai-agents?q=postgresql-helper"
     Then I should see "postgresql-helper"

  Scenario: The AI Skills folder lists the skill the plugin ships
    Given I am on "/ai-skills?q=postgresql-database"
     Then I should see "postgresql-database"

  Scenario: The AI Commands folder lists the command the plugin ships
    Given I am on "/ai-commands?q=postgresql-sizes"
     Then I should see "postgresql-sizes"

  Scenario: The AI Prompts folder lists the prompt the plugin ships
    Given I am on "/ai-prompts?q=postgresql-dump-and-check"
     Then I should see "postgresql-dump-and-check"
