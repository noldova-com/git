/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterNextRender, Component, ElementRef, inject, input, type InputSignal, output, type OutputEmitterRef, PendingTasks, type Signal,
  signal, viewChild, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, RuntimeRequestException, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { type HostReference, HostReviewer } from "@noldova/git.hosting.protocol";
import { TextFieldBoxComponent, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { FoundPerson } from "../../models/found-person.ts";
import { AzureDevOpsPersonAvatarComponent } from "../azure-devops-person-avatar/azure-devops-person-avatar.component.ts";

@Component({
  selector: "nol-git-azure-devops-add-reviewer",
  templateUrl: "./azure-devops-add-reviewer.component.html",
  styleUrl: "./azure-devops-add-reviewer.component.css",
  imports: [AzureDevOpsPersonAvatarComponent, TextFieldBoxComponent, TextFieldComponent]
})
export class AzureDevOpsAddReviewerComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly field: Signal<ElementRef<HTMLInputElement>> = viewChild.required("field", { read: ElementRef });
  private generation: number = 0;

  protected readonly resources: typeof Resources = Resources;
  protected readonly found: WritableSignal<readonly FoundPerson[] | null> = signal<readonly FoundPerson[] | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly adding: WritableSignal<string | null> = signal<string | null>(null);

  public readonly reference: InputSignal<HostReference> = input.required<HostReference>();

  public readonly reviewers: InputSignal<readonly string[]> = input<readonly string[]>([]);

  public readonly added: OutputEmitterRef<HostReviewer> = output<HostReviewer>();

  public readonly closed: OutputEmitterRef<void> = output<void>();

  public constructor() {
    afterNextRender(() => {
      this.field().nativeElement.focus();
    });
  }

  protected shownOf(found: readonly FoundPerson[]): readonly FoundPerson[] {
    const listed: ReadonlySet<string> = new Set(this.reviewers().map(t => t.toLowerCase()));
    return found.filter(t => !listed.has(t.login.toLowerCase()));
  }

  protected search(): void {
    this.generation++;
    this.failure.set(null);
    const text: string = this.field().nativeElement.value.trim();
    if (text.length < Resources.minimumPeopleQuery) {
      this.found.set(null);
      return;
    }
    void this.searchAsync(text);
  }

  protected close(): void {
    this.generation++;
    this.closed.emit();
  }

  protected async addAsync(person: FoundPerson): Promise<void> {
    const generation: number = this.generation;
    const finished = this.tasks.add();
    this.adding.set(person.descriptor);
    this.failure.set(null);
    try {
      const reviewer: HostReviewer = HostReviewer.fromJson(await this.context.requestAsync(AzureDevOpsNames.addReviewerMethod,
        { reference: this.reference().toJson(), descriptor: person.descriptor }));
      if (generation === this.generation)
        this.added.emit(reviewer);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.addReviewerMethod, String(error)));
      if (generation === this.generation)
        this.failure.set(error instanceof RuntimeRequestException ? error.message : Resources.writeUnanswered);
    }
    finally {
      if (generation === this.generation)
        this.adding.set(null);
      finished();
    }
  }

  private async searchAsync(query: string): Promise<void> {
    const generation: number = this.generation;
    const finished = this.tasks.add();
    try {
      const found: readonly FoundPerson[] = FoundPerson.listOf(await this.context.requestAsync(AzureDevOpsNames.searchPeopleMethod,
        { reference: this.reference().toJson(), query }));
      if (generation === this.generation)
        this.found.set(found);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.searchPeopleMethod, String(error)));
      if (generation === this.generation)
        this.failure.set(error instanceof RuntimeRequestException ? error.message : Resources.searchUnanswered);
    }
    finally {
      finished();
    }
  }
}
