import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'

import { Item, Response } from '../../../../../shared/models/question'

let uniqueID = 0

@Component({
  selector: 'checkbox-input',
  templateUrl: 'checkbox-input.component.html'
})
export class CheckboxInputComponent implements OnInit {
  @Output()
  valueChange: EventEmitter<any> = new EventEmitter<any>()

  @Input()
  responses: Response[]
  @Input()
  currentlyShown

  value: number = null
  uniqueID: number = uniqueID++
  name = `checkbox-input-${this.uniqueID}`
  items: Item[] = Array()
  itemsSelected = {}

  ngOnInit() {
    this.responses.map((item, i) => {
      this.items.push({
        id: `check-${this.uniqueID}-${i}`,
        response: item.label,
        value: Number(item.code)
      })
    })
  }

  onInputChange(event) {
    this.logSelectedItems(event)
    this.valueChange.emit(this.retrieveSelectedItems())
  }

  logSelectedItems(item) {
    if (!(item.id in this.itemsSelected)) {
      this.itemsSelected[item.id] = item.value
    } else {
      delete this.itemsSelected[item.id]
    }
  }

  retrieveSelectedItems() {
    const items = []
    for (const key in this.itemsSelected) {
      if (key) {
        items.push(this.itemsSelected[key])
      }
    }
    return items
  }
}
