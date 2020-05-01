import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'

import { StorageKeys } from '../../../shared/enums/storage'
import { Assessment, AssessmentType } from '../../../shared/models/assessment'
import { Question } from '../../../shared/models/question'
import { Task } from '../../../shared/models/task'
import { Utility } from '../../../shared/utilities/util'
import { LocalizationService } from '../misc/localization.service'
import { LogService } from '../misc/log.service'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class QuestionnaireService {
  private readonly QUESTIONNAIRE_STORE = {
    CONFIG_ASSESSMENTS: StorageKeys.CONFIG_ASSESSMENTS,
    CONFIG_CLINICAL_ASSESSMENTS: StorageKeys.CONFIG_CLINICAL_ASSESSMENTS,
    HAS_CLINICAL_TASKS: StorageKeys.HAS_CLINICAL_TASKS
  }

  constructor(
    private storage: StorageService,
    private localization: LocalizationService,
    private http: HttpClient,
    private util: Utility,
    private logger: LogService
  ) {}

  pullQuestionnaires(type: AssessmentType): Promise<Assessment[]> {
    // NOTE: Pull questionnaire definitions
    return this.getAssessments(type)
      .then(assessments => {
        const language = this.localization.getLanguage().value
        const localizeQuestionnaires = assessments.map(a =>
          this.pullQuestionnaireLang(a, language).then(translated => {
            a.questions = this.formatQuestionsHeaders(translated)
            return a
          })
        )
        return Promise.all(localizeQuestionnaires)
      })
      .then(assessments => this.setAssessments(type, assessments))
  }

  pullQuestionnaireLang(assessment, language: string): Promise<Object> {
    const uri = this.formatQuestionnaireUri(assessment.questionnaire, language)
    return this.getQuestionnairesOfLang(uri).catch(e => {
      this.logger.error(`Failed to get questionnaires from ${uri}`, e)
      const URI = this.formatQuestionnaireUri(assessment.questionnaire, '')
      return this.getQuestionnairesOfLang(URI)
    })
  }

  formatQuestionnaireUri(questionnaireRepo, langVal: string) {
    let uri = questionnaireRepo.repository + questionnaireRepo.name + '/'
    uri += questionnaireRepo.name + questionnaireRepo.type
    if (langVal !== '') {
      uri += '_' + langVal
    }
    uri += questionnaireRepo.format
    console.log(uri)
    return uri
  }

  getQuestionnairesOfLang(URI): Promise<Question[]> {
    return this.http
      .get(URI)
      .toPromise()
      .then(res => {
        if (!(res instanceof Array)) {
          throw new Error('URL does not contain an array of questions')
        }
        return res
      }) as Promise<Question[]>
  }

  formatQuestionsHeaders(questions) {
    questions.forEach((q, i) => {
      if (
        i > 0 &&
        !q.section_header &&
        q.matrix_group_name == questions[i - 1].matrix_group_name
      ) {
        q.section_header = questions[i - 1].section_header
      }
    })
    return questions
  }

  updateAssessments(type: AssessmentType, assessments: Assessment[]) {
    // NOTE: Update assessment list from protocol
    switch (type) {
      case AssessmentType.ALL:
        const {
          negative: scheduledAssessments,
          positive: clinicalAssessments
        } = this.util.partition(
          assessments,
          a => a.type == AssessmentType.ON_DEMAND
        )
        return Promise.all([
          this.setHasClinicalTasks(clinicalAssessments.length > 0),
          this.updateAssessments(AssessmentType.ON_DEMAND, clinicalAssessments),
          this.updateAssessments(AssessmentType.SCHEDULED, scheduledAssessments)
        ])
      default:
        return this.setAssessments(type, assessments)
          .then(() => this.pullQuestionnaires(type))
          .catch(e => {
            throw this.logger.error(
              'Failed to update ' + type + ' assessments',
              e
            )
          })
    }
  }

  updateAssessment(type: AssessmentType, assessment: Assessment) {
    return this.getAssessments(type).then(assessments => {
      const index = assessments.findIndex(a => a.name == assessment.name)
      if (index != -1) {
        assessments[index] = this.util.deepCopy(assessment)
        return this.setAssessments(type, assessments)
      }
    })
  }

  getAssessment(type: AssessmentType, task: Task) {
    return this.getAssessments(type).then(assessments =>
      assessments.find(a => a.name === task.name)
    )
  }

  getAssessments(type) {
    const key = this.getKeyFromTaskType(type)
    return this.storage.get(key)
  }

  setAssessments(type, assessments) {
    const key = this.getKeyFromTaskType(type)
    return this.storage.set(key, assessments)
  }

  getKeyFromTaskType(type: AssessmentType) {
    switch (type) {
      case AssessmentType.ON_DEMAND:
        return this.QUESTIONNAIRE_STORE.CONFIG_CLINICAL_ASSESSMENTS
      default:
        return this.QUESTIONNAIRE_STORE.CONFIG_ASSESSMENTS
    }
  }

  setHasClinicalTasks(value) {
    return this.storage.set(this.QUESTIONNAIRE_STORE.HAS_CLINICAL_TASKS, value)
  }

  getHasClinicalTasks() {
    return this.storage.get(this.QUESTIONNAIRE_STORE.HAS_CLINICAL_TASKS)
  }

  reset() {
    return Promise.all([
      this.setAssessments(AssessmentType.ON_DEMAND, {}),
      this.setAssessments(AssessmentType.SCHEDULED, {})
    ])
  }
}
