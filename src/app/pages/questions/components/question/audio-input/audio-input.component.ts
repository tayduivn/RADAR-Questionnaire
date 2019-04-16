import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core'
import { AlertController, NavController, Platform } from 'ionic-angular'

import {
  MIN_SEC,
  SEC_MILLISEC
} from '../../../../../../assets/data/defaultConfig'
import { LocKeys } from '../../../../../shared/enums/localisations'
import { Section } from '../../../../../shared/models/question'
import { TranslatePipe } from '../../../../../shared/pipes/translate/translate'
import { AndroidPermissionUtility } from '../../../../../shared/utilities/android-permission'
import { HomePageComponent } from '../../../../home/containers/home-page.component'
import { AudioRecordService } from '../../../services/audio-record.service'

@Component({
  selector: 'audio-input',
  templateUrl: 'audio-input.component.html'
})
export class AudioInputComponent implements OnChanges, OnDestroy, OnInit {
  @Output()
  valueChange: EventEmitter<any> = new EventEmitter<any>()
  @Input()
  sections: Section[]
  @Input()
  currentlyShown: boolean

  alertShown = false
  resumeListener
  pauseListener

  constructor(
    private audioRecordService: AudioRecordService,
    private permissionUtil: AndroidPermissionUtility,
    public navCtrl: NavController,
    public alertCtrl: AlertController,
    private platform: Platform,
    private translate: TranslatePipe
  ) {
    this.permissionUtil.checkPermissions()
  }

  ngOnInit() {
    this.onResume()
    this.onClose()
  }

  ngOnChanges() {
    // if (this.currentlyShown) this.startRecording()
  }

  ngOnDestroy() {
    this.resumeListener.unsubscribe()
    this.pauseListener.unsubscribe()
  }

  onResume() {
    this.resumeListener = this.platform.resume.subscribe(() =>
      this.showTaskInterruptedAlert()
    )
  }

  onClose() {
    // NOTE: Stop audio recording when application is on pause / backbutton is pressed
    this.pauseListener = this.platform.pause.subscribe(() =>
      this.stopRecording()
    )
    this.platform.registerBackButtonAction(() => {
      this.stopRecording()
      this.platform.exitApp()
    })
  }

  startRecording() {
    this.permissionUtil.getRecordAudio_Permission().then(success => {
      if (success) {
        this.audioRecordService
          .startAudioRecording()
          .catch(e => this.showTaskInterruptedAlert())
      } else {
        this.showTaskInterruptedAlert()
      }
    })
  }

  stopRecording() {
    this.audioRecordService
      .stopAudioRecording()
      .then(data => {
        console.log(data)
        return this.valueChange.emit(data)
      })
      .catch(e => this.showTaskInterruptedAlert())
    this.audioRecordService.destroy()
  }

  isRecording() {
    return this.audioRecordService.isRecording
  }

  showTaskInterruptedAlert() {
    if (!this.alertShown) {
      const buttons = [
        {
          text: this.translate.transform(LocKeys.BTN_OKAY.toString()),
          handler: () => {
            this.navCtrl.setRoot(HomePageComponent)
          }
        }
      ]
      this.showAlert({
        title: 'Audio task interrupted',
        message: 'Task has been interrupted. Restart task.',
        buttons: buttons
      })
      this.alertShown = true
    }
  }

  showAlert(parameters) {
    const alert = this.alertCtrl.create({
      title: parameters.title,
      buttons: parameters.buttons
    })
    if (parameters.message) {
      alert.setMessage(parameters.message)
    }
    if (parameters.inputs) {
      for (let i = 0; i < parameters.inputs.length; i++) {
        alert.addInput(parameters.inputs[i])
      }
    }
    alert.present()
  }
}
