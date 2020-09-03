import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Injectable } from '@angular/core'
import * as moment from 'moment-timezone'

import {
  DefaultAppServerURL,
  DefaultRequestJSONContentType
} from '../../../../assets/data/defaultConfig'
import { ConfigKeys } from '../../../shared/enums/config'
import { StorageKeys } from '../../../shared/enums/storage'
import { RemoteConfigService } from '../config/remote-config.service'
import { SubjectConfigService } from '../config/subject-config.service'
import { LocalizationService } from '../misc/localization.service'
import { LogService } from '../misc/log.service'
import { StorageService } from '../storage/storage.service'
import { TokenService } from '../token/token.service'

@Injectable()
export class AppServerService {
  private APP_SERVER_URL = DefaultAppServerURL
  SUBJECT_PATH = 'users'
  PROJECT_PATH = 'projects'

  constructor(
    public storage: StorageService,
    public subjectConfig: SubjectConfigService,
    public logger: LogService,
    public remoteConfig: RemoteConfigService,
    public localization: LocalizationService,
    private token: TokenService,
    private http: HttpClient
  ) {}

  init() {
    // NOTE: Initialising ensures project and subject exists in the app server
    return this.updateAppServerURL()
      .then(() =>
        Promise.all([
          this.subjectConfig.getParticipantLogin(),
          this.subjectConfig.getProjectName(),
          this.subjectConfig.getEnrolmentDate(),
          this.getFCMToken()
        ])
      )
      .then(([subjectId, projectId, enrolmentDate, fcmToken]) =>
        this.addProjectIfMissing(projectId).then(() =>
          this.addSubjectIfMissing(
            subjectId,
            projectId,
            enrolmentDate,
            fcmToken
          )
        )
      )
  }

  getHeaders() {
    return Promise.all([
      this.updateAppServerURL(),
      this.token.getTokens()
    ]).then(([, tokens]) =>
      new HttpHeaders()
        .set('Authorization', 'Bearer ' + tokens.access_token)
        .set('Content-Type', DefaultRequestJSONContentType)
    )
  }

  getProject(projectId): Promise<any> {
    return this.getHeaders().then(headers =>
      this.http
        .get(`${this.APP_SERVER_URL}/${this.PROJECT_PATH}/${projectId}`, {
          headers
        })
        .toPromise()
    )
  }

  addProjectIfMissing(projectId): Promise<any> {
    return this.getProject(projectId).catch(e => {
      if (e.status == 404) return this.addProjectToServer(projectId)
      else return
    })
  }

  addProjectToServer(projectId) {
    return this.getHeaders().then(headers =>
      this.http
        .post(
          `${this.APP_SERVER_URL}/${this.PROJECT_PATH}/`,
          { projectId },
          { headers }
        )
        .toPromise()
    )
  }

  getSubject(subjectId): Promise<any> {
    return this.getHeaders().then(headers =>
      this.http
        .get(`${this.APP_SERVER_URL}/${this.SUBJECT_PATH}/${subjectId}`, {
          headers
        })
        .toPromise()
    )
  }

  addSubjectIfMissing(
    subjectId,
    projectId,
    enrolmentDate,
    fcmToken
  ): Promise<any> {
    // NOTE: Adds subject if missing, updates subject if it exists
    return this.getSubject(subjectId)
      .then(subject =>
        this.updateSubject(subject, {
          fcmToken,
          lastOpened: new Date(),
          timezone: moment.tz.guess(),
          language: this.localization.getLanguage().value
        })
      )
      .catch(e => {
        if (e.status == 404)
          return this.addSubjectToServer(
            subjectId,
            projectId,
            enrolmentDate,
            fcmToken
          )
        else return
      })
  }

  addSubjectToServer(subjectId, projectId, enrolmentDate, fcmToken) {
    return this.getHeaders().then(headers =>
      this.http
        .post(
          `${this.APP_SERVER_URL}/${this.PROJECT_PATH}/${projectId}/${this.SUBJECT_PATH}/`,
          {
            enrolmentDate: new Date(enrolmentDate),
            projectId,
            subjectId,
            fcmToken,
            timezone: moment.tz.guess(),
            language: this.localization.getLanguage().value
          },
          { headers }
        )
        .toPromise()
    )
  }

  updateSubject(subject, properties) {
    return this.getHeaders().then(headers => {
      const updatedSubject = Object.assign(subject, properties)
      const projectId = subject.projectId
      const subjectId = subject.subjectId
      return this.http
        .put(
          `${this.APP_SERVER_URL}/${this.PROJECT_PATH}/${projectId}/${this.SUBJECT_PATH}/${subjectId}`,
          updatedSubject,
          { headers }
        )
        .toPromise()
    })
  }

  getFCMToken() {
    return this.storage.get(StorageKeys.FCM_TOKEN)
  }

  updateAppServerURL() {
    return this.remoteConfig
      .read()
      .then(config =>
        config.getOrDefault(ConfigKeys.APP_SERVER_URL, DefaultAppServerURL)
      )
      .then(url => (this.APP_SERVER_URL = url))
  }

  getAppServerURL() {
    return this.APP_SERVER_URL
  }
}
